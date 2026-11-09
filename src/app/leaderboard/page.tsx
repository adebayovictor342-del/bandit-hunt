import Header from "@/components/Header";
import Footer from "@/components/Footer";
import LeaderboardClient from "@/components/LeaderboardClient";
export const metadata = { title: "Leaderboard | Sambisa Fighter" };
export default function LeaderboardPage() {
  return <div className="site-page"><Header/><main className="site-container inner-page"><div className="eyebrow"><span className="live-dot"/> THE COMPETITION</div><h1>THE LEADERBOARD<span>.</span></h1><p className="page-intro">The best runs. The biggest names. Where do you stand?</p><LeaderboardClient/></main><Footer/></div>;
}
