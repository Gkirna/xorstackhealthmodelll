import { useLocation } from "react-router-dom";
import Welcome from "./Welcome";
import Signup from "./Signup";
import Login from "./Login";
import OnboardingProfile from "./OnboardingProfile";
import Dashboard from "./Dashboard";
import SessionNew from "./SessionNew";
import SessionRecord from "./SessionRecord";
import SessionReview from "./SessionReview";
import Sessions from "./Sessions";

const Index = () => {
  const location = useLocation();

  switch (location.pathname) {
    case "/signup": return <Signup />;
    case "/login": return <Login />;
    case "/onboarding/profile": return <OnboardingProfile />;
    case "/dashboard": return <Dashboard />;
    case "/session/new": return <SessionNew />;
    case "/sessions": return <Sessions />;
    default:
      if (location.pathname.startsWith("/session/") && location.pathname.endsWith("/record")) {
        return <SessionRecord />;
      }
      if (location.pathname.startsWith("/session/") && location.pathname.endsWith("/review")) {
        return <SessionReview />;
      }
      return <Welcome />;
  }
};

export default Index;
