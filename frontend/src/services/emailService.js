import emailjs from '@emailjs/browser';

const STORAGE_KEY = 'tm_emailjs_config';

export const emailService = {
  // Get stored EmailJS configuration with 'almtr1p' prefilled from your EmailJS template
  getConfig() {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        return {
          serviceId: (parsed.serviceId || '').trim().replace(/^["']|["']$/g, ''),
          templateId: (parsed.templateId || 'almtr1p').trim().replace(/^["']|["']$/g, ''),
          publicKey: (parsed.publicKey || '').trim().replace(/^["']|["']$/g, ''),
        };
      }
    } catch {
      // fallback
    }
    return {
      serviceId:
        (typeof import.meta !== 'undefined' && import.meta.env?.VITE_EMAILJS_SERVICE_ID) || '',
      templateId:
        (typeof import.meta !== 'undefined' && import.meta.env?.VITE_EMAILJS_TEMPLATE_ID) ||
        'almtr1p',
      publicKey:
        (typeof import.meta !== 'undefined' && import.meta.env?.VITE_EMAILJS_PUBLIC_KEY) || '',
    };
  },

  // Save configuration with sanitization (removes accidental quotes and spaces)
  saveConfig(config) {
    const sanitized = {
      serviceId: (config.serviceId || '').trim().replace(/^["']|["']$/g, ''),
      templateId: (config.templateId || '').trim().replace(/^["']|["']$/g, ''),
      publicKey: (config.publicKey || '').trim().replace(/^["']|["']$/g, ''),
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
  async sendInviteEmail({ toName, toEmail, inviteLink, companyName, department, role }) {
    const config = this.getConfig();

    if (!this.isConfigured()) {
      return {
        success: false,
        reason: 'NOT_CONFIGURED',
        message: 'EmailJS credentials are not configured yet.',
      };
    }

    // Matches your EmailJS template variables from screenshot
    const templateParams = {
      to_name: toName,
      name: companyName || 'TaskFlow Administrator',
      to_email: toEmail,
      recipient_email: toEmail,
      email: toEmail,
      invite_link: inviteLink,
      link: inviteLink,
      company_name: companyName || 'Company Workspace',
      department: department || 'General',
      role: (role || 'employee').replace(/_/g, ' '),
      expires_in: '24 hours',
    };

    try {
      const response = await emailjs.send(
        config.serviceId.trim(),
        config.templateId.trim(),
        templateParams,
        config.publicKey.trim()
      );

      return {
        success: true,
        status: response.status,
        message: `Email sent successfully to ${toEmail}!`,
      };
    } catch (err) {
      console.error('EmailJS error:', err);
      const errMsg =
        err?.text || err?.message || 'Failed to send email through EmailJS.';
      return {
        success: false,
        reason: 'SEND_FAILED',
        message: errMsg,
      };
    }
  },
};
