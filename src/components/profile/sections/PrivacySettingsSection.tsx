// Privacy Settings Section
import React from 'react';
import { PrivacyToggle } from '../atoms/PrivacyToggle.tsx';

interface PrivacySettingsSectionProps {
    privacy: {
        isPublic: boolean;
        allowFollowers: boolean;
        showWeight: boolean;
        showAge: boolean;
        showCalories: boolean;
        showDetailedTraining: boolean;
        showSleep: boolean;
    };
    onToggle: (key: string, value: boolean) => void;
}

export function PrivacySettingsSection({ privacy, onToggle }: PrivacySettingsSectionProps) {
    return (
        <div className="grid md:grid-cols-2 gap-3">
            <PrivacyToggle
                label="Publik Profil"
                desc="Syns i sök"
                active={privacy.isPublic}
                onToggle={() => onToggle('isPublic', !privacy.isPublic)}
            />
            <PrivacyToggle
                label="Tillåt Följare"
                active={privacy.allowFollowers}
                onToggle={() => onToggle('allowFollowers', !privacy.allowFollowers)}
            />
            <PrivacyToggle
                label="Visa Vikt"
                active={privacy.showWeight}
                onToggle={() => onToggle('showWeight', !privacy.showWeight)}
            />
            <PrivacyToggle
                label="Visa Ålder"
                active={privacy.showAge}
                onToggle={() => onToggle('showAge', !privacy.showAge)}
            />
            <PrivacyToggle
                label="Visa Kalorier"
                active={privacy.showCalories}
                onToggle={() => onToggle('showCalories', !privacy.showCalories)}
            />
            <PrivacyToggle
                label="Visa Träning"
                active={privacy.showDetailedTraining}
                onToggle={() => onToggle('showDetailedTraining', !privacy.showDetailedTraining)}
            />
            <PrivacyToggle
                label="Visa Sömn"
                active={privacy.showSleep}
                onToggle={() => onToggle('showSleep', !privacy.showSleep)}
            />
        </div>
    );
}
