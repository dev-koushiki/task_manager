const http = require("http");
const path = require("path");
require("dotenv").config({ path: path.join(__dirname, ".env") });
require("dotenv").config();

const {
  connectDB,
  disconnectDB,
  getConnectionStatus,
  getMongoOptions,
  mongoose,
} = require("./config/database");

const app = require("./server");

let testServer = null;
const TEST_PORT = 5055;

function assert(condition, message) {
  if (!condition) {
    console.error(`  ✗ FAIL: ${message}`);
    throw new Error(`Assertion failed: ${message}`);
  }
  console.log(`  ✓ PASS: ${message}`);
}

function makeRequest(method, endpoint, body = null, headers = {}) {
  return new Promise((resolve, reject) => {
    const postData = body ? JSON.stringify(body) : "";
    const reqHeaders = {
      ...headers,
    };
    if (body) {
      reqHeaders["Content-Type"] = "application/json";
      reqHeaders["Content-Length"] = Buffer.byteLength(postData);
    }

    const req = http.request(
      {
        hostname: "127.0.0.1",
        port: TEST_PORT,
        path: endpoint,
        method: method,
        headers: reqHeaders,
      },
      (res) => {
        let data = "";
        res.on("data", (chunk) => {
          data += chunk;
        });
        res.on("end", () => {
          let json = null;
          try {
            json = JSON.parse(data);
          } catch (_) {
            json = data;
          }
          resolve({ status: res.statusCode, headers: res.headers, data: json });
        });
      }
    );

    req.on("error", reject);
    if (postData) {
      req.write(postData);
    }
    req.end();
  });
}

async function runVerification() {
  console.log("=================================================");
  console.log("MONGODB CONNECTION MANAGEMENT & OPTIMIZATION TEST");
  console.log("=================================================\n");

  const testSuffix = Date.now();
  const testEmail = `test_conn_${testSuffix}@example.com`;
  const testPassword = "Password123!";
  let createdUserId = null;
  let authToken = null;

  try {
    // 1. Verify Connection Pool Options
    console.log("TEST 1: Verifying MongoDB Atlas M0 Pool Configuration...");
    const opts = getMongoOptions();
    assert(opts.maxPoolSize === 5, `maxPoolSize is correctly set to 5 (actual: ${opts.maxPoolSize})`);
    assert(opts.minPoolSize === 0, `minPoolSize is correctly set to 0 (actual: ${opts.minPoolSize})`);
    assert(opts.maxIdleTimeMS === 30000, `maxIdleTimeMS is set to 30000ms (actual: ${opts.maxIdleTimeMS})`);
    assert(opts.serverSelectionTimeoutMS === 5000, `serverSelectionTimeoutMS is set to 5000ms (actual: ${opts.serverSelectionTimeoutMS})`);

    // 2. Connect to MongoDB
    console.log("\nTEST 2: Connecting to MongoDB...");
    const conn1 = await connectDB();
    assert(mongoose.connection.readyState === 1, "Mongoose readyState is 1 (connected)");

    // 3. Test Singleton / Connection Deduplication
    console.log("\nTEST 3: Testing Concurrent Connection Deduplication...");
    const [conn2, conn3, conn4] = await Promise.all([
      connectDB(),
      connectDB(),
      connectDB(),
    ]);
    assert(conn1 === conn2 && conn2 === conn3 && conn3 === conn4, "Multiple connectDB() calls return the identical shared connection instance");

    // 4. Test Safe Status Inspection
    console.log("\nTEST 4: Inspecting Health and Readiness Status...");
    const status = getConnectionStatus();
    assert(status.isConnected === true, "status.isConnected is true");
    assert(status.status === "connected", 'status.status is "connected"');
    assert(status.pool.maxPoolSize === 5, "Pool maxPoolSize is 5");
    assert(!status.uri, "Raw URI and credentials are NOT exposed in status");

    // 5. Start Test HTTP Server
    console.log(`\nTEST 5: Starting Test HTTP Server on port ${TEST_PORT}...`);
    await new Promise((resolve) => {
      testServer = app.listen(TEST_PORT, "127.0.0.1", () => {
        resolve();
      });
    });
    assert(testServer.listening, `Test server is actively listening on port ${TEST_PORT}`);

    // 6. Test Health Check Endpoint (GET /health)
    console.log("\nTEST 6: Testing GET /health (When Connected)...");
    const healthRes = await makeRequest("GET", "/health");
    assert(healthRes.status === 200, `GET /health returns HTTP 200 (actual: ${healthRes.status})`);
    assert(healthRes.data.status === "healthy", `Response status is "healthy"`);
    assert(healthRes.data.database.status === "connected", `Database status is "connected"`);
    assert(healthRes.data.database.readyState === 1, `Database readyState is 1`);

    // Also test alias GET /api/health
    const apiHealthRes = await makeRequest("GET", "/api/health");
    assert(apiHealthRes.status === 200, `GET /api/health returns HTTP 200 (actual: ${apiHealthRes.status})`);

    // 7. Test Root Info Endpoint
    console.log("\nTEST 7: Testing Root Endpoints (GET / and GET /api)...");
    const rootRes = await makeRequest("GET", "/");
    assert(rootRes.status === 200, "GET / returns HTTP 200");
    assert(rootRes.data.endpoints.health === "/health", "Root info lists /health endpoint");

    // 8. Test User Registration via API (Database Write Query)
    console.log("\nTEST 8: Testing User Registration via Express Route...");
    const registerRes = await makeRequest("POST", "/api/auth/register", {
      firstName: "Conn",
      lastName: "Tester",
      email: testEmail,
      password: testPassword,
      companyName: `ConnTestCorp_${testSuffix}`,
      designation: "Lead Engineer",
    });
    assert(
      registerRes.status === 200 || registerRes.status === 201,
      `User registration returns success (HTTP ${registerRes.status})`
    );
    assert(registerRes.data.token, "Registration response includes JWT token");
    authToken = registerRes.data.token;
    createdUserId = registerRes.data.user?._id || registerRes.data.user?.id;

    // 9. Test User Login via API (Database Read & Verification)
    console.log("\nTEST 9: Testing User Login via Express Route...");
    const loginRes = await makeRequest("POST", "/api/auth/login", {
      email: testEmail,
      password: testPassword,
    });
    assert(loginRes.status === 200, `Login returns HTTP 200`);
    assert(loginRes.data.token, "Login response includes JWT token");

    // 10. Test Protected API Route
    console.log("\nTEST 10: Testing Authenticated Route (GET /api/auth/me)...");
    const meRes = await makeRequest("GET", "/api/auth/me", null, {
      Authorization: `Bearer ${authToken}`,
    });
    assert(meRes.status === 200, "Authenticated GET /api/auth/me returns HTTP 200");
    const fetchedEmail = meRes.data.user?.email || meRes.data.email;
    assert(fetchedEmail === testEmail, `User email matches (${testEmail})`);

    // 11. Test Disconnection & 503 Health Monitoring
    console.log("\nTEST 11: Testing Database Disconnection Handling & Health 503 Response...");
    await disconnectDB();
    assert(mongoose.connection.readyState === 0, "Mongoose readyState is 0 (disconnected)");

    const unhealthRes = await makeRequest("GET", "/health");
    assert(
      unhealthRes.status === 503,
      `GET /health returns HTTP 503 when DB is disconnected (actual: ${unhealthRes.status})`
    );
    assert(
      unhealthRes.data.status === "unhealthy",
      `Health response status is "unhealthy"`
    );
    assert(
      unhealthRes.data.database.status === "disconnected",
      `Database status reflects "disconnected"`
    );

    // 12. Test Reconnection After Disconnection
    console.log("\nTEST 12: Testing Reconnection After Disconnection...");
    await connectDB();
    assert(mongoose.connection.readyState === 1, "Mongoose reconnected successfully (readyState 1)");

    const reconnectedHealthRes = await makeRequest("GET", "/health");
    assert(
      reconnectedHealthRes.status === 200,
      `GET /health returns HTTP 200 after reconnection (actual: ${reconnectedHealthRes.status})`
    );

    // Cleanup: Delete test user
    if (createdUserId) {
      console.log("\nCleaning up test user records...");
      const User = require("./models/User");
      const Organization = require("./models/Organization");
      await User.deleteOne({ _id: createdUserId });
      await Organization.deleteMany({ name: `ConnTestCorp_${testSuffix}` });
      console.log("  ✓ PASS: Cleaned up test database records");
    }

    console.log("\n=================================================");
    console.log("ALL MONGODB OPTIMIZATION & CONNECTION TESTS PASSED!");
    console.log("=================================================\n");
  } finally {
    if (testServer && testServer.listening) {
      await new Promise((resolve) => testServer.close(resolve));
    }
    await disconnectDB();
  }
}

runVerification()
  .then(() => {
    process.exit(0);
  })
  .catch((err) => {
    console.error("\nVerification test failed:", err);
    process.exit(1);
  });
