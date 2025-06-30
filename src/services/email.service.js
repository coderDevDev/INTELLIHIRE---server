const nodemailer = require('nodemailer');
const User = require('../models/user.model');
const Job = require('../models/job.model');
const Company = require('../models/company.model');

class EmailService {
  constructor() {
    this.transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: process.env.SMTP_PORT,
      secure: process.env.SMTP_SECURE === 'true',
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS
      }
    });
  }

  // Send job match notification to applicant
  async sendJobMatchNotification(applicantId, jobId, matchScore) {
    try {
      const [applicant, job, company] = await Promise.all([
        User.findById(applicantId),
        Job.findById(jobId),
        Job.findById(jobId).then(job => Company.findById(job.companyId))
      ]);

      if (!applicant || !job || !company) {
        throw new Error('Required data not found');
      }

      const subject = `New Job Match: ${job.title} at ${company.name}`;
      const html = `
        <h2>New Job Match Found!</h2>
        <p>Hello ${applicant.firstName},</p>
        <p>We found a job that matches your profile with a match score of ${(
          matchScore * 100
        ).toFixed(1)}%.</p>
        <h3>Job Details:</h3>
        <ul>
          <li><strong>Position:</strong> ${job.title}</li>
          <li><strong>Company:</strong> ${company.name}</li>
          <li><strong>Location:</strong> ${job.location}</li>
          <li><strong>Employment Type:</strong> ${job.employmentType}</li>
          ${
            job.salaryMin
              ? `<li><strong>Salary Range:</strong> ${job.salaryMin} - ${job.salaryMax} ${job.salaryCurrency}</li>`
              : ''
          }
        </ul>
        <p>Click here to view the full job details and apply: <a href="${
          process.env.FRONTEND_URL
        }/jobs/${job._id}">View Job</a></p>
        <p>Best regards,<br>InteliHire Team</p>
      `;

      await this.sendEmail(applicant.email, subject, html);
    } catch (error) {
      console.error('Error sending job match notification:', error);
      throw error;
    }
  }

  // Send job recommendations to applicant
  async sendJobRecommendations(applicantId, recommendations) {
    try {
      const applicant = await User.findById(applicantId);
      if (!applicant) {
        throw new Error('Applicant not found');
      }

      const subject = 'Your Weekly Job Recommendations';
      const html = `
        <h2>Your Job Recommendations</h2>
        <p>Hello ${applicant.firstName},</p>
        <p>Here are your personalized job recommendations for this week:</p>
        ${recommendations
          .map(
            rec => `
          <div style="margin-bottom: 20px; padding: 15px; border: 1px solid #eee; border-radius: 5px;">
            <h3>${rec.job.title}</h3>
            <p><strong>Company:</strong> ${rec.company.name}</p>
            <p><strong>Match Score:</strong> ${(rec.matchScore * 100).toFixed(
              1
            )}%</p>
            <p><strong>Location:</strong> ${rec.job.location}</p>
            <p><strong>Employment Type:</strong> ${rec.job.employmentType}</p>
            <a href="${process.env.FRONTEND_URL}/jobs/${
              rec.job._id
            }" style="display: inline-block; padding: 10px 20px; background-color: #007bff; color: white; text-decoration: none; border-radius: 5px;">View Job</a>
          </div>
        `
          )
          .join('')}
        <p>Best regards,<br>InteliHire Team</p>
      `;

      await this.sendEmail(applicant.email, subject, html);
    } catch (error) {
      console.error('Error sending job recommendations:', error);
      throw error;
    }
  }

  // Send application status update notification
  async sendApplicationStatusUpdate(applicationId, status) {
    try {
      const application = await Application.findById(applicationId)
        .populate('jobId')
        .populate('applicantId')
        .populate({
          path: 'jobId',
          populate: { path: 'companyId' }
        });

      if (!application) {
        throw new Error('Application not found');
      }

      const subject = `Application Status Update: ${application.jobId.title}`;
      const html = `
        <h2>Application Status Update</h2>
        <p>Hello ${application.applicantId.firstName},</p>
        <p>Your application for ${application.jobId.title} at ${
        application.jobId.companyId.name
      } has been updated.</p>
        <p><strong>New Status:</strong> ${status}</p>
        ${
          application.interviewDate
            ? `
          <h3>Interview Details:</h3>
          <ul>
            <li><strong>Date:</strong> ${new Date(
              application.interviewDate
            ).toLocaleDateString()}</li>
            <li><strong>Location:</strong> ${application.interviewLocation}</li>
            <li><strong>Type:</strong> ${application.interviewType}</li>
          </ul>
        `
            : ''
        }
        <p>Click here to view your application: <a href="${
          process.env.FRONTEND_URL
        }/applications/${application._id}">View Application</a></p>
        <p>Best regards,<br>InteliHire Team</p>
      `;

      await this.sendEmail(application.applicantId.email, subject, html);
    } catch (error) {
      console.error('Error sending application status update:', error);
      throw error;
    }
  }

  // Generic email sending method
  async sendEmail(to, subject, html) {
    try {
      const mailOptions = {
        from: `"InteliHire" <${process.env.SMTP_USER}>`,
        to,
        subject,
        html
      };

      await this.transporter.sendMail(mailOptions);
    } catch (error) {
      console.error('Error sending email:', error);
      throw error;
    }
  }
}

module.exports = new EmailService();
