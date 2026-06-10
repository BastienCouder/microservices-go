import { useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";

import { useOnboarding } from "@/hooks/use-onboarding";
import {
  ACCOUNT_SETUP_SEARCH,
  getOnboardingSetupMode,
} from "./onboarding-mode";

export function StepAccountType() {
  const navigate = useNavigate();
  const location = useLocation();
  const { setStep } = useOnboarding();

  useEffect(() => {
    if (getOnboardingSetupMode(location.search) !== "account") {
      navigate(`/onboarding${ACCOUNT_SETUP_SEARCH}`, { replace: true });
      return;
    }

    setStep(2);
  }, [location.search, navigate, setStep]);

  return null;
}
