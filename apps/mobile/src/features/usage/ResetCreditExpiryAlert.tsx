import { useAtomValue } from "@effect/atom-react";
import {
  collectResetCreditExpiryWarnings,
  resetCreditExpiryNotificationKey,
  resetCreditExpiryWarningView,
} from "@t3tools/shared/usageLimits";
import * as Linking from "expo-linking";
import { useEffect, useMemo, useState } from "react";
import { Alert, AppState } from "react-native";

import { environmentPresentations } from "../../state/presentation";

const DRIVER_LABEL: Partial<Record<string, string>> = { codex: "Codex", claudeAgent: "Claude" };
const seenNotificationKeys = new Set<string>();

/** Native counterpart to the web reminder; it never invokes credit redemption. */
export function ResetCreditExpiryAlert() {
  const presentations = useAtomValue(environmentPresentations.presentationsAtom);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const subscription = AppState.addEventListener("change", (state) => {
      if (state === "active") setNow(Date.now());
    });
    return () => subscription.remove();
  }, []);

  const warnings = useMemo(
    () => collectResetCreditExpiryWarnings(presentations, now),
    [now, presentations],
  );
  const notificationKey = resetCreditExpiryNotificationKey(warnings);

  useEffect(() => {
    if (!notificationKey || seenNotificationKeys.has(notificationKey)) return;
    seenNotificationKeys.add(notificationKey);
    const view = resetCreditExpiryWarningView(warnings, (driver) => DRIVER_LABEL[driver]);
    if (view === null) return;
    Alert.alert(view.title, view.description, [
      { text: "Later", style: "cancel" },
      {
        text: "View limits",
        onPress: () => void Linking.openURL(Linking.createURL("/settings/usage")),
      },
    ]);
  }, [notificationKey, warnings]);

  return null;
}
