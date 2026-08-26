import { resendClient, sender } from "../lib/resend.js";
import { createWelcomeEmailTemplate, createPasswordResetEmailTemplate, createVerificationEmailTemplate } from "../emails/emailTemplates.js";


export const sendWelcomeEmail = async (email,name,clientURL)=>{
    const {data,error} = await resendClient.emails.send({
        from:`${sender.name} <${sender.email}>`,
        to:email,
        subject:"Welcome to Chat",
        html: createWelcomeEmailTemplate(name,clientURL),
    });

    if(error){
        console.error("Error sending welcome email: ",error);
        throw new Error("Failed to send welcome email");
    }else{
        console.log("Welcome email sent successfully",data);
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
        console.error("Error sending password reset email: ", error);
        throw new Error("Failed to send password reset email");
    } else {
        console.log("Password reset email sent successfully", data);
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
        console.error("Error sending verification email: ", error);
        throw new Error("Failed to send verification email");
    } else {
        console.log("Verification email sent successfully", data);
    }
};