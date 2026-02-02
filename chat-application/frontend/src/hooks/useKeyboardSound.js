const keyStrokeSounds = [
    new Audio('/sounds/keystroke1.mp3'),
    new Audio('/sounds/keystroke2.mp3'),
    new Audio('/sounds/keystroke3.mp3'),
    new Audio('/sounds/keystroke4.mp3'),
];

function useKeyboardSound(){
    const playRandomKeyStrokeSound = () => {
        const randomIndex = Math.floor(Math.random() * keyStrokeSounds.length);
        keyStrokeSounds[randomIndex].play();
    };
    return { playRandomKeyStrokeSound };
}

export default useKeyboardSound;