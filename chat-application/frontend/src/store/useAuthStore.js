import {create} from 'zustand';

export const useAuthStore = create((set)=>({
    authUser: {name:"sarthak", _id:2329,age:21},
    isLoggedIn:false,
    login: ()=>{
        console.log("I just logged in");
        set({isLoggedIn:true});
    },
}));