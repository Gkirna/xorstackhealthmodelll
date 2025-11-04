import { useLocation } from "react-router-dom";
import Welcome from "./Welcome";
import Signup from "./Signup";
import Login from "./Login";
import OnboardingProfile from "./OnboardingProfile";
import Dashboard from "./Dashboard";
import SessionNew from "./SessionNew";
import SessionUploadAudio from "./SessionUploadAudio";
import SessionRecord from "./SessionRecord";
import SessionReview from "./SessionReview";
import Sessions from "./Sessions";
import { ProtectedRoute } from "@/components/ProtectedRoute";

const Index = () => {
  const location = useLocation();

  switch (location.pathname) {
    case "/signup": return <Signup />;
    case "/login": return <Login />;
    case "/onboarding/profile": 
      return <ProtectedRoute><OnboardingProfile /></ProtectedRoute>;
    case "/dashboard": 
      return <ProtectedRoute><Dashboard /></ProtectedRoute>;
    case "/session/new": 
      return <ProtectedRoute><SessionNew /></ProtectedRoute>;
    case "/session/upload-audio": 
      return <ProtectedRoute><SessionUploadAudio /></ProtectedRoute>;
    case "/sessions": 
      return <ProtectedRoute><Sessions /></ProtectedRoute>;
    default:
      if (location.pathname.startsWith("/session/") && location.pathname.endsWith("/record")) {
        return <ProtectedRoute><SessionRecord /></ProtectedRoute>;
      }
      if (location.pathname.startsWith("/session/") && location.pathname.endsWith("/review")) {
        return <ProtectedRoute><SessionReview /></ProtectedRoute>;
      }
      return <Welcome />;
  }
};

export default Index;
