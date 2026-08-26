export function createWelcomeEmailTemplate(name, clientURL) {
    return `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Welcome to Messenger</title>
    </head>
    <body style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f5f5f5;">
      <div style="background: linear-gradient(to right, #36D1DC, #5B86E5); padding: 30px; text-align: center; border-radius: 12px 12px 0 0;">
        <div style="width: 80px; height: 80px; margin: 0 auto 20px; background: rgba(255,255,255,0.2); border-radius: 50%; font-size: 40px; line-height: 80px; text-align: center;">💬</div>
        <h1 style="color: white; margin: 0; font-size: 28px; font-weight: 500;">Welcome to Messenger!</h1>
      </div>
      <div style="background-color: #ffffff; padding: 35px; border-radius: 0 0 12px 12px; box-shadow: 0 4px 15px rgba(0,0,0,0.05);">
        <p style="font-size: 18px; color: #5B86E5;"><strong>Hello ${name},</strong></p>
        <p>We're excited to have you join our messaging platform! Messenger connects you with friends, family, and colleagues in real-time, no matter where they are.</p>
        
        <div style="background-color: #f8f9fa; padding: 25px; border-radius: 10px; margin: 25px 0; border-left: 4px solid #36D1DC;">
          <p style="font-size: 16px; margin: 0 0 15px 0;"><strong>Get started in just a few steps:</strong></p>
          <ul style="padding-left: 20px; margin: 0;">
            <li style="margin-bottom: 10px;">Set up your profile picture</li>
            <li style="margin-bottom: 10px;">Find and add your contacts</li>
            <li style="margin-bottom: 10px;">Start a conversation</li>
            <li style="margin-bottom: 0;">Share photos, videos, and more</li>
          </ul>
        </div>
        
        <div style="text-align: center; margin: 30px 0;">
          <a href=${clientURL} style="background: linear-gradient(to right, #36D1DC, #5B86E5); color: white; text-decoration: none; padding: 12px 30px; border-radius: 50px; font-weight: 500; display: inline-block;">Open Messenger</a>
        </div>
        
        <p style="margin-bottom: 5px;">If you need any help or have questions, we're always here to assist you.</p>
        <p style="margin-top: 0;">Happy messaging!</p>
        
        <p style="margin-top: 25px; margin-bottom: 0;">Best regards,<br>The Messenger Team</p>
      </div>
      
      <div style="text-align: center; padding: 20px; color: #999; font-size: 12px;">
        <p>© 2025 Messenger. All rights reserved.</p>
        <p>
          <a href="#" style="color: #5B86E5; text-decoration: none; margin: 0 10px;">Privacy Policy</a>
          <a href="#" style="color: #5B86E5; text-decoration: none; margin: 0 10px;">Terms of Service</a>
          <a href="#" style="color: #5B86E5; text-decoration: none; margin: 0 10px;">Contact Us</a>
        </p>
      </div>
    </body>
    </html>
    `;
  }

export function createPasswordResetEmailTemplate(name, resetLink) {
  return `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Reset Your Messenger Password</title>
    </head>
    <body style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f5f5f5;">
      <div style="background: linear-gradient(to right, #36D1DC, #5B86E5); padding: 30px; text-align: center; border-radius: 12px 12px 0 0;">
        <h1 style="color: white; margin: 0; font-size: 28px; font-weight: 500;">Password Reset</h1>
      </div>
      <div style="background-color: #ffffff; padding: 35px; border-radius: 0 0 12px 12px; box-shadow: 0 4px 15px rgba(0,0,0,0.05);">
        <p style="font-size: 18px; color: #5B86E5;"><strong>Hello ${name},</strong></p>
        <p>We received a request to reset your Messenger password. Click the button below to choose a new one.</p>

        <div style="text-align: center; margin: 30px 0;">
          <a href="${resetLink}" style="background: linear-gradient(to right, #36D1DC, #5B86E5); color: white; text-decoration: none; padding: 12px 30px; border-radius: 50px; font-weight: 500; display: inline-block;">Reset Password</a>
        </div>

        <div style="background-color: #fff8e1; padding: 15px 20px; border-radius: 8px; border-left: 4px solid #f59e0b; margin: 20px 0;">
          <p style="margin: 0; font-size: 14px; color: #92400e;">⏰ This link expires in <strong>1 hour</strong>. If you didn't request a password reset, you can safely ignore this email — your password will not change.</p>
        </div>

        <p style="font-size: 12px; color: #999; word-break: break-all;">If the button above doesn't work, copy and paste this link into your browser:<br/>${resetLink}</p>

        <p style="margin-top: 25px; margin-bottom: 0;">Best regards,<br>The Messenger Team</p>
      </div>

      <div style="text-align: center; padding: 20px; color: #999; font-size: 12px;">
        <p>© 2025 Messenger. All rights reserved.</p>
      </div>
    </body>
    </html>
  `;
}

export function createVerificationEmailTemplate(name, verifyLink) {
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
    </head>
    <body style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f5f5f5;">
      <div style="background: linear-gradient(to right, #36D1DC, #5B86E5); padding: 30px; text-align: center; border-radius: 12px 12px 0 0;">
        <div style="width: 80px; height: 80px; margin: 0 auto 20px; background: rgba(255,255,255,0.2); border-radius: 50%; font-size: 40px; line-height: 80px; text-align: center;">✉️</div>
        <h1 style="color: white; margin: 0; font-size: 28px; font-weight: 500;">Verify Your Email</h1>
      </div>
      <div style="background-color: #ffffff; padding: 35px; border-radius: 0 0 12px 12px; box-shadow: 0 4px 15px rgba(0,0,0,0.05);">
        <p style="font-size: 18px; color: #5B86E5;"><strong>Hello ${name},</strong></p>
        <p>Thanks for signing up! Click the button below to verify your email address and start chatting.</p>

        <div style="text-align: center; margin: 30px 0;">
          <a href="${verifyLink}" style="background: linear-gradient(to right, #36D1DC, #5B86E5); color: white; text-decoration: none; padding: 12px 30px; border-radius: 50px; font-weight: 500; display: inline-block;">Verify Email Address</a>
        </div>

        <div style="background-color: #fff8e1; padding: 15px 20px; border-radius: 8px; border-left: 4px solid #f59e0b; margin: 20px 0;">
          <p style="margin: 0; font-size: 14px; color: #92400e;">⏰ This link expires in <strong>24 hours</strong>. If you didn't create a Messenger account, you can safely ignore this email.</p>
        </div>

        <p style="font-size: 12px; color: #999; word-break: break-all;">If the button above doesn't work, copy and paste this link into your browser:<br/>${verifyLink}</p>

        <p style="margin-top: 25px; margin-bottom: 0;">Welcome aboard,<br>The Messenger Team</p>
      </div>

      <div style="text-align: center; padding: 20px; color: #999; font-size: 12px;">
        <p>© 2025 Messenger. All rights reserved.</p>
      </div>
    </body>
    </html>
  `;
}