import { useAtomValue } from "@effect/atom-react";
import {
  collectResetCreditExpiryWarnings,
  resetCreditExpiryNotificationKey,
  RESET_CREDIT_REMINDER_SETTLE_GRACE_MS,
  RESET_CREDIT_REMINDER_STABILIZE_MS,
  resetCreditExpiryWarningView,
} from "@t3tools/shared/usageLimits";
import { useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";

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
  const unmountTimerRef = useRef<number | null>(null);
  const warnings = useMemo(
    () => collectResetCreditExpiryWarnings(presentations, Date.parse(`${nowMinute}:00.000Z`)),
    [nowMinute, presentations],
  );
  const notificationKey = resetCreditExpiryNotificationKey(warnings);
  const isAnyEnvironmentSettling = useMemo(
    () =>
      [...presentations.values()].some(
        ({ connection, serverConfig }) =>
          connection.phase === "connecting" ||
          connection.phase === "reconnecting" ||
          (connection.phase === "connected" && serverConfig === null),
      ),
    [presentations],
  );
  const [settleGraceElapsed, setSettleGraceElapsed] = useState(false);

  useEffect(() => {
    const resetTimer = window.setTimeout(() => setSettleGraceElapsed(false), 0);
    if (!isAnyEnvironmentSettling) return () => window.clearTimeout(resetTimer);

    const graceTimer = window.setTimeout(
      () => setSettleGraceElapsed(true),
      RESET_CREDIT_REMINDER_SETTLE_GRACE_MS,
    );
    return () => {
      window.clearTimeout(resetTimer);
      window.clearTimeout(graceTimer);
    };
  }, [isAnyEnvironmentSettling]);
  const isGated = isAnyEnvironmentSettling && !settleGraceElapsed;

  useEffect(() => {
    if (unmountTimerRef.current !== null) {
      window.clearTimeout(unmountTimerRef.current);
      unmountTimerRef.current = null;
    }
    return () => {
      unmountTimerRef.current = window.setTimeout(() => {
        const active = activeToastRef.current;
        activeToastRef.current = null;
        if (active) toastManager.close(active.toastId);
      }, 0);
    };
  }, []);

  useEffect(() => {
    const active = activeToastRef.current;
    if (active?.key === notificationKey) return;
    if (active && !isGated && !isAnyEnvironmentSettling) {
      activeToastRef.current = null;
      toastManager.close(active.toastId);
    }
    if (!notificationKey || isGated || seenNotificationKeys.has(notificationKey)) return;

    const timer = window.setTimeout(() => {
      const view = resetCreditExpiryWarningView(
        warnings,
        (driver) => getDriverOption(driver)?.label,
      );
      if (view === null || seenNotificationKeys.has(notificationKey)) return;

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
      seenNotificationKeys.add(notificationKey);
      activeToastRef.current = { key: notificationKey, toastId };
    }, RESET_CREDIT_REMINDER_STABILIZE_MS);
    return () => window.clearTimeout(timer);
  }, [isAnyEnvironmentSettling, isGated, navigate, notificationKey, warnings]);

  return null;
}
