// Privacy Settings Section
import React from "react";
import { PrivacyToggle } from "../atoms/PrivacyToggle.tsx";
import { VisibilitySelector } from "../atoms/VisibilitySelector.tsx";
import { UserPrivacy, VisibilityLevel } from "../../../models/types.ts";

interface PrivacySettingsSectionProps {
  privacy: UserPrivacy;
  onToggle: (key: string, value: boolean) => void;
  onUpdateSharing: (
    category: keyof UserPrivacy["sharing"],
    level: VisibilityLevel,
  ) => void;
}

export function PrivacySettingsSection(
  { privacy, onToggle, onUpdateSharing }: PrivacySettingsSectionProps,
) {
  return (
    <div className="space-y-6">
      {/* Profilsynlighet */}
      <div className="space-y-3">
        <h4 className="text-[10px] text-slate-500 uppercase font-bold tracking-widest pl-1">
          Profil & System
        </h4>
        <div className="grid md:grid-cols-2 gap-3">
          <PrivacyToggle
            label="Publik Profil"
            desc="Syns i sök och för alla"
            active={privacy.isPublic}
            onToggle={() => onToggle("isPublic", !privacy.isPublic)}
          />
          <PrivacyToggle
            label="Tillåt Följare"
            active={privacy.allowFollowers}
            onToggle={() => onToggle("allowFollowers", !privacy.allowFollowers)}
          />
          <PrivacyToggle
            label="Visa Vikt"
            active={privacy.showWeight}
            onToggle={() => onToggle("showWeight", !privacy.showWeight)}
          />
          <PrivacyToggle
            label="Visa Detaljerad Träning"
            active={privacy.showDetailedTraining}
            onToggle={() =>
              onToggle("showDetailedTraining", !privacy.showDetailedTraining)}
          />
        </div>
      </div>

      {/* Granulär delning (The Matrix) */}
      <div className="space-y-3">
        <h4 className="text-[10px] text-slate-500 uppercase font-bold tracking-widest pl-1">
          The Sharing Matrix
        </h4>
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-3">
          <VisibilitySelector
            label="Träning"
            value={privacy.sharing.training}
            onChange={(l) => onUpdateSharing("training", l)}
            icon="🏋️"
          />
          <VisibilitySelector
            label="Kost & Vatten"
            value={privacy.sharing.nutrition}
            onChange={(l) => onUpdateSharing("nutrition", l)}
            icon="🍎"
          />
          <VisibilitySelector
            label="Sömn & Hälsa"
            value={privacy.sharing.health}
            onChange={(l) => onUpdateSharing("health", l)}
            icon="💤"
          />
          <VisibilitySelector
            label="Kroppsmått"
            value={privacy.sharing.body}
            onChange={(l) => onUpdateSharing("body", l)}
            icon="⚖️"
          />
          <VisibilitySelector
            label="Socialt"
            value={privacy.sharing.social}
            onChange={(l) => onUpdateSharing("social", l)}
            icon="📣"
          />
        </div>
      </div>
    </div>
  );
}
