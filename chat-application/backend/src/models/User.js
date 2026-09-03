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
    // X25519 public key (raw bytes, base64-encoded) published by the client for E2EE key exchange.
    // The matching private key is stored only in the client's IndexedDB and is never sent to the server.
    publicKey:{
        type:String,
        default:null,
        maxlength:100, // raw X25519 key is 32 bytes → 44 chars base64
    },
},{timestamps:true});

const User = mongoose.model("User",userSchema);

export default User;
