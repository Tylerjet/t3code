import { useAtomValue } from "@effect/atom-react";
import {
  collectResetCreditExpiryWarnings,
  resetCreditExpiryNotificationKey,
  resetCreditExpiryWarningView,
} from "@t3tools/shared/usageLimits";
import { useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useRef } from "react";

import { useNowMinute } from "../hooks/useNowMinute";
import { environmentPresentations } from "../state/presentation";
import { getDriverOption } from "./settings/providerDriverMeta";
import { stackedThreadToast, toastManager } from "./ui/toast";

const seenNotificationKeys = new Set<string>();

type ExpiryToastId = ReturnType<typeof toastManager.add>;

/** One launch-time reminder for every distinct set of credits nearing expiry. */
export function ResetCreditExpiryNotification() {
  const navigate = useNavigate();
  const presentations = useAtomValue(environmentPresentations.presentationsAtom);
  const nowMinute = useNowMinute();
  const activeToastRef = useRef<{ readonly key: string; readonly toastId: ExpiryToastId } | null>(
    null,
  );
  const warnings = useMemo(
    () => collectResetCreditExpiryWarnings(presentations, Date.parse(`${nowMinute}:00.000Z`)),
    [nowMinute, presentations],
  );
  const notificationKey = resetCreditExpiryNotificationKey(warnings);

  useEffect(
    () => () => {
      const active = activeToastRef.current;
      if (active) toastManager.close(active.toastId);
    },
    [],
  );

  useEffect(() => {
    const active = activeToastRef.current;
    if (active?.key === notificationKey) return;
    if (active) {
      activeToastRef.current = null;
      toastManager.close(active.toastId);
    }
    if (!notificationKey || seenNotificationKeys.has(notificationKey)) return;

    seenNotificationKeys.add(notificationKey);
    const view = resetCreditExpiryWarningView(warnings, (driver) => getDriverOption(driver)?.label);
    if (view === null) return;

    let toastId!: ExpiryToastId;
    const openLimits = () => {
      toastManager.close(toastId);
      void navigate({ to: "/usage", search: { metric: "limits" } });
    };
    toastId = toastManager.add(
      stackedThreadToast({
        type: "warning",
        title: view.title,
        description: view.description,
        timeout: 0,
        actionProps: { children: "View limits", onClick: openLimits },
        actionVariant: "outline",
        data: {
          hideCopyButton: true,
          onClose: () => {
            if (activeToastRef.current?.toastId === toastId) {
              activeToastRef.current = null;
            }
          },
        },
      }),
    );
    activeToastRef.current = { key: notificationKey, toastId };
  }, [navigate, notificationKey, warnings]);

  return null;
}
