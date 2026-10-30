import emailjs from '@emailjs/browser';

const STORAGE_KEY = 'tm_emailjs_config';

const DEFAULT_SERVICE_ID = 'service_3937bmg';
const DEFAULT_TEMPLATE_ID = 'template_e8t3gmy';
const DEFAULT_PUBLIC_KEY = 'GoX15NC8DvUYOjl2M';

export const emailService = {
  // Get stored EmailJS configuration with fallbacks from env and defaults
  getConfig() {
    const envServiceId =
      typeof import.meta !== 'undefined' && import.meta.env?.VITE_EMAILJS_SERVICE_ID
        ? String(import.meta.env.VITE_EMAILJS_SERVICE_ID).trim()
        : '';
    const envTemplateId =
      typeof import.meta !== 'undefined' && import.meta.env?.VITE_EMAILJS_TEMPLATE_ID
        ? String(import.meta.env.VITE_EMAILJS_TEMPLATE_ID).trim()
        : '';
    const envPublicKey =
      typeof import.meta !== 'undefined' && import.meta.env?.VITE_EMAILJS_PUBLIC_KEY
        ? String(import.meta.env.VITE_EMAILJS_PUBLIC_KEY).trim()
        : '';

    let stored = {};
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        stored = JSON.parse(raw) || {};
      }
    } catch {
      // fallback
    }

    const cleanStoredService = (stored.serviceId && typeof stored.serviceId === 'string') ? stored.serviceId.trim() : '';
    let cleanStoredTemplate = (stored.templateId && typeof stored.templateId === 'string') ? stored.templateId.trim() : '';
    // Upgrade legacy/broken template IDs from localStorage automatically
    if (cleanStoredTemplate === 'almtr1p') {
      cleanStoredTemplate = '';
    }
    const cleanStoredPublic = (stored.publicKey && typeof stored.publicKey === 'string') ? stored.publicKey.trim() : '';

    const serviceId = (
      cleanStoredService ||
      envServiceId ||
      DEFAULT_SERVICE_ID
    ).trim().replace(/^["']|["']$/g, '');

    const templateId = (
      cleanStoredTemplate ||
      envTemplateId ||
      DEFAULT_TEMPLATE_ID
    ).trim().replace(/^["']|["']$/g, '');

    const publicKey = (
      cleanStoredPublic ||
      envPublicKey ||
      DEFAULT_PUBLIC_KEY
    ).trim().replace(/^["']|["']$/g, '');

    return { serviceId, templateId, publicKey };
  },

  // Save configuration with sanitization
  saveConfig(config) {
    const sanitized = {
      serviceId: (config.serviceId || DEFAULT_SERVICE_ID).trim().replace(/^["']|["']$/g, ''),
      templateId: (config.templateId || DEFAULT_TEMPLATE_ID).trim().replace(/^["']|["']$/g, ''),
      publicKey: (config.publicKey || DEFAULT_PUBLIC_KEY).trim().replace(/^["']|["']$/g, ''),
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(sanitized));
  },

  // Check if EmailJS is configured
  isConfigured() {
    const config = this.getConfig();
    return Boolean(
      config.serviceId &&
      config.serviceId.trim() &&
      config.templateId &&
      config.templateId.trim() &&
      config.publicKey &&
      config.publicKey.trim()
    );
  },

  // Send an invitation email using EmailJS
  async sendInviteEmail(params = {}) {
    const config = this.getConfig();

    const toName = params.toName || params.employee_name || params.to_name || 'Team Member';
    const toEmail = (
      params.toEmail ||
      params.to_email ||
      params.recipient_email ||
      params.email ||
      ''
    ).trim();
    const inviteLink = params.inviteLink || params.invitation_link || params.link || params.url || '';
    const companyName = params.companyName || params.company_name || 'Taskflow';
    const department = params.department || 'General';
    const role = (params.role || params.role_name || 'Specialist').replace(/_/g, ' ');

    if (!toEmail) {
      return {
        success: false,
        reason: 'NO_EMAIL',
        message: 'Recipient email address is required.',
      };
    }

    if (!this.isConfigured()) {
      return {
        success: false,
        reason: 'NOT_CONFIGURED',
        message: 'EmailJS credentials are not configured yet.',
      };
    }

    // Comprehensive template parameters covering common template variable names
    const templateParams = {
      to_name: toName,
      name: companyName,
      to_email: toEmail,
      recipient_email: toEmail,
      email: toEmail,
      user_email: toEmail,
      invite_link: inviteLink,
      link: inviteLink,
      invitation_link: inviteLink,
      url: inviteLink,
      company_name: companyName,
      department: department,
      role: role,
      role_name: role,
      expires_in: '7 days',
    };

    try {
      console.log('Sending EmailJS with:', {
        serviceId: config.serviceId.trim(),
        templateId: config.templateId.trim(),
        publicKey: config.publicKey ? 'configured' : 'missing',
      });

      // Ensure SDK is initialized with public key
      emailjs.init({ publicKey: config.publicKey.trim() });

      // Send using EmailJS v5 syntax with options object containing publicKey
      const response = await emailjs.send(
        config.serviceId.trim(),
        config.templateId.trim(),
        templateParams,
        {
          publicKey: config.publicKey.trim(),
        }
      );

      console.log('EmailJS response:', response);

      return {
        success: true,
        status: response.status,
        message: `Email sent successfully to ${toEmail}!`,
      };
    } catch (err) {
      console.error('EmailJS error:', err);
      const errMsg =
        err?.text ||
        err?.message ||
        (typeof err === 'string' ? err : 'Failed to send email through EmailJS.');
      return {
        success: false,
        reason: 'SEND_FAILED',
        message: errMsg,
      };
    }
  },

  // Alias for sendInviteEmail
  async sendInvitation(params) {
    return this.sendInviteEmail(params);
  },

  // Helper to construct mailto link as direct mail client fallback
  getMailtoLink({ toEmail, toName, companyName, role, department, inviteLink } = {}) {
    const email = toEmail || '';
    const name = toName || 'there';
    const company = companyName || 'Taskflow';
    const dept = department || 'General';
    const roleTitle = (role || 'team member').replace(/_/g, ' ');

    const subject = encodeURIComponent(`Invitation to join ${company} as ${roleTitle}`);
    const body = encodeURIComponent(
      `Hello ${name},\n\n` +
      `You have been invited to join ${company} as a ${roleTitle} in the ${dept} department.\n\n` +
      `Click the secure link below to accept your invitation and activate your account:\n` +
      `${inviteLink}\n\n` +
      `Note: This invitation link is valid for 7 days.\n\n` +
      `Best regards,\n${company}`
    );

    return `mailto:${email}?subject=${subject}&body=${body}`;
  },
};
