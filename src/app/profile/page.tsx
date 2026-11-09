import Header from "@/components/Header";
import Footer from "@/components/Footer";
import ProfileClient from "@/components/ProfileClient";
export const metadata = { title: "My Profile | Sambisa Fighter" };
export default function ProfilePage() { return <div className="site-page"><Header/><main className="site-container inner-page"><ProfileClient/></main><Footer/></div>; }
