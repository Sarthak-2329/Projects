import { resendClient, sender } from "../lib/resend.js";
import { createWelcomeEmailTemplate, createPasswordResetEmailTemplate, createVerificationEmailTemplate } from "../emails/emailTemplates.js";
import { logger } from "../lib/logger.js";

export const sendWelcomeEmail = async (email, name, clientURL) => {
    const { data, error } = await resendClient.emails.send({
        from: `${sender.name} <${sender.email}>`,
        to: email,
        subject: "Welcome to Chat",
        html: createWelcomeEmailTemplate(name, clientURL),
    });

    if (error) {
        logger.error({ error, email }, "Error sending welcome email");
        throw new Error("Failed to send welcome email");
    } else {
        logger.info({ email, id: data?.id }, "Welcome email sent successfully");
    }
};

export const sendPasswordResetEmail = async (email, name, resetLink) => {
    const { data, error } = await resendClient.emails.send({
        from: `${sender.name} <${sender.email}>`,
        to: email,
        subject: "Reset your Messenger password",
        html: createPasswordResetEmailTemplate(name, resetLink),
    });

    if (error) {
        logger.error({ error, email }, "Error sending password reset email");
        throw new Error("Failed to send password reset email");
    } else {
        logger.info({ email, id: data?.id }, "Password reset email sent successfully");
    }
};

export const sendVerificationEmail = async (email, name, verifyLink) => {
    const { data, error } = await resendClient.emails.send({
        from: `${sender.name} <${sender.email}>`,
        to: email,
        subject: "Verify your Messenger email address",
        html: createVerificationEmailTemplate(name, verifyLink),
    });

    if (error) {
        logger.error({ error, email }, "Error sending verification email");
        throw new Error("Failed to send verification email");
    } else {
        logger.info({ email, id: data?.id }, "Verification email sent successfully");
    }
};