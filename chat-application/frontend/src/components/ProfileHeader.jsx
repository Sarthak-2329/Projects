import { useState, useRef } from "react";
import { LogOutIcon, VolumeOffIcon, Volume2Icon, LockIcon } from "lucide-react";
import { useAuthStore } from "../store/useAuthStore";
import { useChatStore } from "../store/useChatStore";

const mouseClickSound = new Audio("/sounds/mouse-click.mp3");

function ProfileHeader() {
  const { logout, authUser, updateProfile } = useAuthStore();
  const { isSoundEnabled, toggleSound } = useChatStore();
  const [selectedImg, setSelectedImg] = useState(null);
  const fileInputRef = useRef(null);

  const handleImageUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onloadend = async () => {
      const base64Image = reader.result;
      setSelectedImg(base64Image);
      await updateProfile({ profilePic: base64Image });
    };
  };

  return (
    <div className="p-5 border-b border-ink/10">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          {/* Avatar */}
          <div className="relative">
            <button
              className="size-14 rounded-full overflow-hidden relative group ring-2 ring-ink/10 ring-offset-2 ring-offset-cream"
              onClick={() => fileInputRef.current.click()}
            >
              <img
                src={selectedImg || authUser.profilePic || "/avatar.png"}
                alt="User image"
                className="size-full object-cover"
              />
              <div className="absolute inset-0 bg-ink/30 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                <span className="text-cream text-xs">Change</span>
              </div>
            </button>
            {/* Online dot — sage green, distinct from forest accent */}
            <span className="absolute bottom-0 right-1 w-3.5 h-3.5 bg-sage border-2 border-cream rounded-full" />
            <input
              type="file"
              accept="image/*"
              ref={fileInputRef}
              onChange={handleImageUpload}
              className="hidden"
            />
          </div>

          {/* Name & status */}
          <div>
            <h3 className="font-serif text-ink font-medium text-base max-w-[160px] truncate">
              {authUser.fullName}
            </h3>
            <p className="text-sage text-xs font-medium">Online</p>
            {/* E2EE notice */}
            <p
              className="text-ink/30 text-[10px] flex items-center gap-1 mt-0.5"
              title="Direct messages are end-to-end encrypted. Your private key is stored only in this browser."
            >
              <LockIcon className="w-2.5 h-2.5 shrink-0" />
              E2E encrypted · Key on this device only
            </p>
          </div>
        </div>

        {/* Action buttons */}
        <div className="flex gap-3 items-center">
          <button
            className="text-ink/40 hover:text-ink transition-colors"
            onClick={logout}
          >
            <LogOutIcon className="size-5" />
          </button>
          <button
            className="text-ink/40 hover:text-ink transition-colors"
            onClick={() => {
              mouseClickSound.currentTime = 0;
              mouseClickSound.play().catch((err) => console.log("Audio play failed:", err));
              toggleSound();
            }}
          >
            {isSoundEnabled ? (
              <Volume2Icon className="size-5" />
            ) : (
              <VolumeOffIcon className="size-5" />
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

export default ProfileHeader;