import { Suspense } from "react";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import AuthForm from "@/components/AuthForm";
export const metadata = { title: "Sign in | Sambisa Fighter" };
export default function SignInPage() { return <div className="site-page"><Header/><main className="site-container auth-page"><Suspense fallback={<div className="auth-loading">Loading...</div>}><AuthForm mode="signin"/></Suspense></main><Footer/></div>; }
