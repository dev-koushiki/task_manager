
const express = require("express");
const Employee = require("../models/Employee");

const router = express.Router();

// Add a new employee
router.post("/", async (req, res) => {
  try {
    const { name, email, department, position, role, manager } = req.body;

    const employee = await Employee.create({
      name,
      email,
      department,
      position,
      role,
      manager: manager || null,
    });

    res.status(201).json({
      message: "Employee created successfully",
      employee,
    });
  } catch (error) {
    res.status(400).json({
      message: error.code === 11000
        ? "This email is already registered"
        : error.message,
    });
  }
});

// Get all employees
router.get("/", async (req, res) => {
  try {
    const employees = await Employee.find()
      .populate("manager", "name position");

    res.json(employees);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Delete an employee
router.delete("/:id", async (req, res) => {
  try {
    const employee = await Employee.findByIdAndDelete(req.params.id);
    if (!employee) {
      return res.status(404).json({ message: "Employee not found" });
    }
    res.json({ message: "Employee deleted successfully" });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;
