const handlebars = require('handlebars');

// Base email template with modern styling matching your UI
const baseTemplate = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>{{title}}</title>
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }
        
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
            line-height: 1.6;
            color: #374151;
            background: linear-gradient(135deg, #f3f4f6 0%, #ffffff 50%, #dbeafe 100%);
            min-height: 100vh;
            padding: 20px;
        }
        
         .email-container {
             max-width: 600px;
             margin: 0 auto;
             background: rgba(255, 255, 255, 0.9);
             backdrop-filter: blur(20px);
             border-radius: 24px;
             box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25);
             border: 1px solid rgba(255, 255, 255, 0.5);
             overflow: hidden;
             position: relative;
         }
         
         .email-container::before {
             content: '';
             position: absolute;
             top: 0;
             left: 0;
             right: 0;
             bottom: 0;
             background: url('data:image/svg+xml,%3Csvg width="60" height="60" viewBox="0 0 60 60" xmlns="http://www.w3.org/2000/svg"%3E%3Cg fill="none" fill-rule="evenodd"%3E%3Cg fill="%233b82f6" fill-opacity="0.02"%3E%3Ccircle cx="30" cy="30" r="1.5"/%3E%3C/g%3E%3C/g%3E%3C/svg%3E') repeat;
             pointer-events: none;
         }
        
         .email-header {
             background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%);
             padding: 40px 30px;
             text-align: center;
             position: relative;
             z-index: 2;
         }
        
        .email-header::before {
            content: '';
            position: absolute;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background: url('data:image/svg+xml,%3Csvg width="60" height="60" viewBox="0 0 60 60" xmlns="http://www.w3.org/2000/svg"%3E%3Cg fill="none" fill-rule="evenodd"%3E%3Cg fill="%23ffffff" fill-opacity="0.1"%3E%3Ccircle cx="30" cy="30" r="2"/%3E%3C/g%3E%3C/g%3E%3C/svg%3E') repeat;
            opacity: 0.3;
        }
        
         .logo {
             position: relative;
             z-index: 1;
             color: white;
             font-size: 32px;
             font-weight: 700;
             margin-bottom: 12px;
             letter-spacing: -0.5px;
         }
         
         .header-subtitle {
             position: relative;
             z-index: 1;
             color: rgba(255, 255, 255, 0.95);
             font-size: 16px;
             font-weight: 500;
         }
        
         .email-content {
             padding: 40px 30px;
             position: relative;
             z-index: 1;
         }
        
         .content-title {
             font-size: 28px;
             font-weight: 700;
             background: linear-gradient(135deg, #1f2937 0%, #374151 100%);
             background-clip: text;
             -webkit-background-clip: text;
             -webkit-text-fill-color: transparent;
             margin-bottom: 20px;
             text-align: center;
             letter-spacing: -0.5px;
         }
        
        .content-message {
            font-size: 16px;
            color: #6b7280;
            margin-bottom: 30px;
            line-height: 1.7;
        }
        
         .cta-button {
             display: inline-block;
             background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%);
             color: white;
             text-decoration: none;
             padding: 16px 32px;
             border-radius: 12px;
             font-weight: 600;
             font-size: 16px;
             text-align: center;
             margin: 20px 0;
             box-shadow: 0 10px 25px -5px rgba(59, 130, 246, 0.3);
             transition: all 0.3s ease;
         }
         
         .cta-button:hover {
             background: linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%);
             transform: translateY(-2px);
             box-shadow: 0 15px 35px -5px rgba(59, 130, 246, 0.4);
         }
        
         .info-box {
             background: linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%);
             border: 1px solid #93c5fd;
             border-radius: 16px;
             padding: 20px;
             margin: 20px 0;
         }
         
         .info-box-title {
             font-weight: 600;
             color: #1d4ed8;
             margin-bottom: 8px;
         }
         
         .info-box-text {
             color: #1e40af;
             font-size: 14px;
         }
        
        .warning-box {
            background: linear-gradient(135deg, #fef3c7 0%, #fde68a 100%);
            border: 1px solid #f59e0b;
            border-radius: 16px;
            padding: 20px;
            margin: 20px 0;
        }
        
        .warning-box-title {
            font-weight: 600;
            color: #92400e;
            margin-bottom: 8px;
        }
        
        .warning-box-text {
            color: #78350f;
            font-size: 14px;
        }
        
         .email-footer {
             background: #f9fafb;
             padding: 30px;
             text-align: center;
             border-top: 1px solid #e5e7eb;
             position: relative;
             z-index: 1;
         }
        
        .footer-text {
            color: #6b7280;
            font-size: 14px;
            margin-bottom: 16px;
        }
        
        .footer-links {
            margin-top: 20px;
        }
        
         .footer-link {
             color: #2563eb;
             text-decoration: none;
             margin: 0 10px;
             font-size: 14px;
             font-weight: 500;
         }
         
         .footer-link:hover {
             color: #1d4ed8;
             text-decoration: underline;
         }
        
        .token-display {
            background: #f3f4f6;
            border: 1px solid #d1d5db;
            border-radius: 8px;
            padding: 12px;
            font-family: 'Courier New', monospace;
            font-size: 12px;
            word-break: break-all;
            margin: 15px 0;
            color: #374151;
        }
        
        @media (max-width: 600px) {
            .email-container {
                margin: 10px;
                border-radius: 16px;
            }
            
            .email-header, .email-content, .email-footer {
                padding: 20px;
            }
            
            .content-title {
                font-size: 20px;
            }
            
            .cta-button {
                display: block;
                width: 100%;
            }
        }
    </style>
</head>
<body>
    <div class="email-container">
        <div class="email-header">
            <div class="logo">InteliHire</div>
            <div class="header-subtitle">AI-Powered Job Matching Platform</div>
        </div>
        
        <div class="email-content">
            <h1 class="content-title">{{title}}</h1>
            <div class="content-message">
                {{message}}
            </div>
            
            {{#if ctaButton}}
            <div style="text-align: center;">
                <a href="{{ctaButton.url}}" class="cta-button">{{ctaButton.text}}</a>
            </div>
            {{/if}}
            
            {{#if infoBox}}
            <div class="info-box">
                <div class="info-box-title">{{infoBox.title}}</div>
                <div class="info-box-text">{{infoBox.text}}</div>
            </div>
            {{/if}}
            
            {{#if warningBox}}
            <div class="warning-box">
                <div class="warning-box-title">{{warningBox.title}}</div>
                <div class="warning-box-text">{{warningBox.text}}</div>
            </div>
            {{/if}}
            
            {{#if token}}
            <div class="token-display">
                <strong>Reset Token:</strong><br>
                {{token}}
            </div>
            {{/if}}
        </div>
        
        <div class="email-footer">
            <div class="footer-text">
                This email was sent from InteliHire. If you didn't request this, please ignore this email.
            </div>
            <div class="footer-links">
                <a href="{{baseUrl}}/login" class="footer-link">Login</a>
                <a href="{{baseUrl}}/register" class="footer-link">Register</a>
                <a href="{{baseUrl}}" class="footer-link">Home</a>
            </div>
        </div>
    </div>
</body>
</html>
`;

// Password reset email template
const passwordResetTemplate = handlebars.compile(baseTemplate);

// Email template data
const getPasswordResetEmailData = (
  email,
  resetToken,
  baseUrl = 'http://localhost:3000'
) => {
  return {
    title: 'Reset Your Password',
    message: `Hello! We received a request to reset your password for your InteliHire account. Click the button below to create a new password.`,
    ctaButton: {
      text: 'Reset Password',
      url: `${baseUrl}/reset-password?token=${resetToken}`
    },
    infoBox: {
      title: '⏰ Token Expires in 1 Hour',
      text: 'For security reasons, this password reset link will expire in 1 hour. If you need to reset your password after that, please request a new reset email.'
    },
    warningBox: {
      title: '🔒 Security Notice',
      text: "If you didn't request this password reset, please ignore this email. Your account remains secure and no changes have been made."
    },
    token: process.env.NODE_ENV === 'development' ? resetToken : null,
    baseUrl: baseUrl
  };
};

// Welcome email template
const getWelcomeEmailData = (firstName, baseUrl = 'http://localhost:3000') => {
  return {
    title: 'Welcome to InteliHire!',
    message: `Hi ${firstName}!<br><br>Welcome to InteliHire! We're excited to have you join our AI-powered job matching platform. Your account has been successfully created and you can now start exploring amazing career opportunities.`,
    ctaButton: {
      text: 'Get Started',
      url: `${baseUrl}/dashboard`
    },
    infoBox: {
      title: "🚀 What's Next?",
      text: 'Complete your profile, upload your resume, and let our AI match you with the perfect job opportunities!'
    },
    baseUrl: baseUrl
  };
};

// Email sending functions
const sendPasswordResetEmail = async (email, resetToken, baseUrl) => {
  const templateData = getPasswordResetEmailData(email, resetToken, baseUrl);
  const html = passwordResetTemplate(templateData);

  return {
    to: email,
    subject: 'Reset Your InteliHire Password',
    html: html
  };
};

const sendWelcomeEmail = async (email, firstName, baseUrl) => {
  const templateData = getWelcomeEmailData(firstName, baseUrl);
  const html = passwordResetTemplate(templateData);

  return {
    to: email,
    subject: 'Welcome to InteliHire!',
    html: html
  };
};

const sendEmailVerificationEmail = async (
  email,
  firstName,
  verificationToken,
  baseUrl
) => {
  const templateData = {
    title: 'Verify Your Email',
    firstName: firstName || 'User',
    message: `Hi ${
      firstName || 'there'
    },<br><br>Thank you for registering with InteliHire! To complete your registration and start your journey, please verify your email address by clicking the button below.`,
    ctaButton: {
      text: 'Verify Email Address',
      url: `${baseUrl}/verify-email/${verificationToken}`
    },
    infoBox: {
      title: '⏰ Important',
      text: 'This verification link will expire in 24 hours. Please verify your email soon to access all features.'
    },
    baseUrl: baseUrl,
    year: new Date().getFullYear()
  };

  const html = passwordResetTemplate(templateData);

  return {
    to: email,
    subject: '✅ Verify Your Email - InteliHire',
    html
  };
};

// Application Status Update Email Templates
const sendApplicationStatusEmail = async (
  email,
  firstName,
  applicationData,
  baseUrl
) => {
  const {
    status,
    jobTitle,
    companyName,
    notes,
    interviewDate,
    interviewLocation,
    interviewType,
    rejectionReason
  } = applicationData;

  // Status-specific messages and styling
  const statusConfig = {
    applied: {
      title: '📝 Application Received',
      emoji: '📝',
      color: '#3b82f6',
      message: `Your application for <strong>${jobTitle}</strong> at <strong>${companyName}</strong> has been received and is under review.`,
      ctaText: 'View Application',
      ctaUrl: `${baseUrl}/dashboard/applicant/applications`
    },
    screening: {
      title: '🔍 Application Under Review',
      emoji: '🔍',
      color: '#f59e0b',
      message: `Good news! Your application for <strong>${jobTitle}</strong> at <strong>${companyName}</strong> is currently being reviewed by our team.`,
      ctaText: 'View Application Status',
      ctaUrl: `${baseUrl}/dashboard/applicant/applications`
    },
    interview: {
      title: '🎉 Interview Invitation',
      emoji: '🎉',
      color: '#8b5cf6',
      message: `Congratulations, ${firstName}! We are pleased to invite you for an interview for the <strong>${jobTitle}</strong> position at <strong>${companyName}</strong>.`,
      ctaText: 'View Interview Details',
      ctaUrl: `${baseUrl}/dashboard/applicant/applications`
    },
    offered: {
      title: '🌟 Job Offer',
      emoji: '🌟',
      color: '#10b981',
      message: `Fantastic news, ${firstName}! We are delighted to offer you the <strong>${jobTitle}</strong> position at <strong>${companyName}</strong>.`,
      ctaText: 'View Offer Details',
      ctaUrl: `${baseUrl}/dashboard/applicant/applications`
    },
    hired: {
      title: '🎊 Welcome Aboard!',
      emoji: '🎊',
      color: '#059669',
      message: `Congratulations, ${firstName}! Welcome to the <strong>${companyName}</strong> team as our new <strong>${jobTitle}</strong>. We look forward to working with you!`,
      ctaText: 'Access Dashboard',
      ctaUrl: `${baseUrl}/dashboard/applicant`
    },
    rejected: {
      title: '📋 Application Update',
      emoji: '📋',
      color: '#6b7280',
      message: `Thank you for your interest in the <strong>${jobTitle}</strong> position at <strong>${companyName}</strong>. After careful consideration, we have decided to move forward with other candidates.`,
      ctaText: 'Browse More Jobs',
      ctaUrl: `${baseUrl}/jobs`
    },
    withdrawn: {
      title: '↩️ Application Withdrawn',
      emoji: '↩️',
      color: '#6b7280',
      message: `Your application for <strong>${jobTitle}</strong> at <strong>${companyName}</strong> has been withdrawn as requested.`,
      ctaText: 'Browse Jobs',
      ctaUrl: `${baseUrl}/jobs`
    }
  };

  const config = statusConfig[status] || statusConfig.applied;

  const templateData = {
    title: config.title,
    message: `Hi ${firstName},<br><br>${config.message}`,
    ctaButton: {
      text: config.ctaText,
      url: config.ctaUrl
    },
    baseUrl: baseUrl,
    year: new Date().getFullYear()
  };

  // Add status notes if provided
  if (notes) {
    templateData.infoBox = {
      title: '💬 Message from Recruiter',
      text: notes
    };
  }

  // Add interview details if status is interview
  if (status === 'interview' && interviewDate) {
    const interviewInfo = [];

    if (interviewDate) {
      const date = new Date(interviewDate);
      interviewInfo.push(
        `📅 <strong>Date & Time:</strong> ${date.toLocaleString('en-US', {
          weekday: 'long',
          year: 'numeric',
          month: 'long',
          day: 'numeric',
          hour: '2-digit',
          minute: '2-digit'
        })}`
      );
    }

    if (interviewType) {
      const typeLabel =
        interviewType === 'in-person'
          ? 'In-Person'
          : interviewType === 'phone'
          ? 'Phone Call'
          : interviewType === 'video'
          ? 'Video Call'
          : interviewType;
      interviewInfo.push(`🎥 <strong>Type:</strong> ${typeLabel}`);
    }

    if (interviewLocation) {
      interviewInfo.push(`📍 <strong>Location:</strong> ${interviewLocation}`);
    }

    templateData.infoBox = {
      title: '📅 Interview Details',
      text: interviewInfo.join('<br>')
    };
  }

  // Add rejection reason if status is rejected and reason provided
  if (status === 'rejected' && rejectionReason) {
    templateData.warningBox = {
      title: '💡 Feedback',
      text: rejectionReason
    };
  }

  const html = passwordResetTemplate(templateData);

  return {
    to: email,
    subject: `${config.emoji} ${config.title} - ${jobTitle} at ${companyName}`,
    html
  };
};

module.exports = {
  passwordResetTemplate,
  getPasswordResetEmailData,
  getWelcomeEmailData,
  sendPasswordResetEmail,
  sendWelcomeEmail,
  sendEmailVerificationEmail,
  sendApplicationStatusEmail
};
