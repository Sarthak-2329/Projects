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
        select:false,
    },
    profilePic:{
        type:String,
        default:"",
    },
    passwordResetToken:{
        type:String,
        select:false,
    },
    passwordResetExpires:{
        type:Date,
        select:false,
    },
    isEmailVerified:{
        type:Boolean,
        default:false,
    },
    emailVerifyToken:{
        type:String,
        select:false,
    },
    emailVerifyExpires:{
        type:Date,
        select:false,
    },
},{timestamps:true});

const User = mongoose.model("User",userSchema);

export default User;
