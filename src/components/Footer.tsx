import Link from "next/link";
import { Brand } from "./Header";
export default function Footer() {
  return <footer className="site-footer"><div className="site-container footer-inner"><Brand small/><span>© {new Date().getFullYear()} AERORANK. ALL RIGHTS RESERVED.</span><div><Link href="/leaderboard">LEADERBOARD</Link><Link href="/profile">PROFILE</Link><Link href="/signin">SIGN IN</Link></div></div></footer>;
}
