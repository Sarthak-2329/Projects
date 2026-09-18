/** @type {import('next').NextConfig} */
const nextConfig = {
  // No special config needed — the frontend calls the FastAPI backend
  // directly via fetch using NEXT_PUBLIC_API_URL from .env.local.
};

export default nextConfig;
