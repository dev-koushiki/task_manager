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

  // Send an invitation email using EmailJS - accepts flexible parameter naming
  async sendInviteEmail(params = {}) {
    const config = this.getConfig();

    const toName = params.toName || params.employee_name || params.to_name || 'Team Member';
    const toEmail = (params.toEmail || params.to_email || params.recipient_email || params.email || '').trim();
    const inviteLink = params.inviteLink || params.invitation_link || params.link || '';
    const companyName = params.companyName || params.company_name || 'Company Workspace';
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
        message: 'EmailJS credentials are not configured yet. Please configure Service ID and Public Key.',
      };
    }

    // Matches template variables
    const templateParams = {
      to_name: toName,
      name: companyName,
      to_email: toEmail,
      recipient_email: toEmail,
      email: toEmail,
      invite_link: inviteLink,
      link: inviteLink,
      invitation_link: inviteLink,
      company_name: companyName,
      department: department,
      role: role,
      role_name: role,
      expires_in: '7 days',
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

  // Alias for sendInviteEmail to prevent 'sendInvitation is not a function' errors
  async sendInvitation(params) {
    return this.sendInviteEmail(params);
  },

  // Helper to construct mailto link as direct mail client fallback
  getMailtoLink({ toEmail, toName, companyName, role, department, inviteLink } = {}) {
    const email = toEmail || '';
    const name = toName || 'there';
    const company = companyName || 'our workspace';
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
