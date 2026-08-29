import mongoose from "mongoose";

const userSchema = new mongoose.Schema({
    email:{
        type:String,
        required:true,
        unique:true,
        lowercase:true,
        trim:true,
    },
    fullName:{
        type:String,
        required:true,
    },
    password:{
        type:String,
        required:true,
        minlength:6,
    },
    profilePic:{
        type:String,
        default:"",
    },
    passwordResetToken:{
        type:String,
    },
    passwordResetExpires:{
        type:Date,
    },
    isEmailVerified:{
        type:Boolean,
        default:false,
    },
    emailVerifyToken:{
        type:String,
    },
    emailVerifyExpires:{
        type:Date,
    },
},{timestamps:true});

const User = mongoose.model("User",userSchema);

export default User;