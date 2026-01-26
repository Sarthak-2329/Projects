import {Button} from "@/components/Button";
import {ArrowRight,Download, Github, Linkedin, Twitter} from "lucide-react";
import {AnimatedBorderButton} from "@/components/AnimatedBorderButton";

export const Hero = ()=>{
    return (
    <section className="relative min-h-screen flex items-center overflow-hidden">
        <div className="absolute inset-0">
            <img src="/hero-bg.jpg" alt="Hero image" className="w-full h-full object-cover opacity-40"/>
            <div className="absolute inset-0 bg-gradient-to-b from-background/20 via-background/80 to-background"/>
        </div>

        <div className="absolute inset-0 overflow-hidden pointer-events-none">
            {[...Array(30)].map((_,i)=>(
                <div className="absolute w-1.5 h-1.5 rounded-full opacity-60"
                style={{
                    backgroundColor: "#20B2A6",
                    left: `${Math.random()*100}%`,
                    top: `${Math.random()*100}%`,
                    animation: `slow-drift ${15+Math.random()*20}s ease-in-out infinite`,
                    animationDelay: `${Math.random()*5}s`,
                }}/>
            ))}
        </div>
        <div className="container mx-auto px-6 pt-32 pb-20 relative z-10">
            <div className="grid lg:grid-cols-2 gap-12 items-center"> 
                <div className="space-y-8">
                    <div className="animate-fade-in">
                        <span className="inline-flex items-center gap-2 px-4 py-2 rounded-full glass text-sm text-primary ">
                        <span className="w-2 h-2 bg-primary rounded-full animate-pulse"/>Software Engineer - Student
                        </span>
                    </div>
                    <div className="space-y-4 ">
                        <h1 className="text-xl md:text-6xl lg:text-7xl font-bold leading-tight animate-fade-in animation-delay-100">
                            Crafting <span className="text-primary glow-text">digital</span>
                            <br />
                            experiences with
                            <br />
                            <span className="font-serif italic font-normal text-white">
                                precision.
                            </span>
                        </h1>
                        <p className="text-lg text-muted-foreground max-w-lg animate-fade-in animation-delay-200">
                            Hi, I'm Sarthak Surale - a student of Indian Institute of Information Technology, Vadodara. 
                            I am specializing in React, Next.js, and TypeScript. I build scalable web applications that 
                            users love.
                        </p>
                    </div>
                    <div className="flex flex-wrap gap-4 animate-fade-in animation-delay-300">
                        <Button size="lg">Contact Me <ArrowRight className="w-5 h-5"/></Button>
                        <AnimatedBorderButton/>
                    </div>
                    <div className="flex items-center gap-4 animate-fade-in animation-delay-400">
                        <span className="text-sm text-muted-foreground ">Follow me: </span>
                        {[{icon: Github,href:"#"},{icon: Linkedin,href:"#"},{icon: Twitter,href:"#"},].map((social,idx)=>(
                            <a key={idx} href={social.href} className="p-2 rounded-full glass hover:bg-primary/10 hover:text-primary transition-all duration-300">{<social.icon className="w-5 h-5"/>}</a>
                        ))}
                    </div>
                    <div className="relative animate-fade-in animation-delay-300 ">
                        <div className="relative max-w-md mx-auto">
                        <div className="absolute inset-0 rounded-3xl bg-gradient-to-br from-primary/30 via-transparent to-primary/10 blur-2xl animate-pulse"/>
                            <div className="relative glass rounded-3xl p-2 glow-border">
                                <img src="/profile-photo.jpg" alt="Sarthak Surale" className="w-full aspect-[4/5] object-cover rounded-2xl" />
                                <div className="absolute -bottom-4 -right-4 glass rounded-xl px-4 py-3 animate-float">
                                    <div className="flex items-center gap-3 ">
                                        <div className="w-3 h-3 bg-green-500 rounded-full animate-pulse"/>
                                        <span className="text-sm font-medium">Available for Work</span>
                                    </div>
                                </div>
                                <div className="absolute -top-4 -left-4 glass rounded-xl px-4 py-3 animate-float animation-delay-500">
                                    <div className="text-2xl font-bold text-primary">No</div>
                                    <div className="text-xs text-muted-foreground">Experience</div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    </section>);
};