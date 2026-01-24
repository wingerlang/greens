import React from "react";
import { DashboardCardWrapper } from "../../../components/dashboard/DashboardCardWrapper.tsx";
import { SleepCard } from "../../../components/dashboard/SleepCard.tsx";
import { WaterCard } from "../../../components/dashboard/WaterCard.tsx";
import { AlcoholCard } from "../../../components/dashboard/AlcoholCard.tsx";
import { CaffeineCard } from "../../../components/dashboard/index.ts";

// Sleep Card Wrapper
interface DashboardSleepCardProps {
  isDone: boolean;
  onToggle: (id: string, e: React.MouseEvent) => void;
  density: string;
  sleep: number;
  isEditing: boolean;
  tempValue: string;
  onCardClick: () => void;
  onValueChange: (val: string) => void;
  onSave: (val: number) => void;
  onClear: () => void;
  onCancel: () => void;
}

export const DashboardSleepCard: React.FC<DashboardSleepCardProps> = ({
  isDone,
  onToggle,
  density,
  sleep,
  isEditing,
  tempValue,
  onCardClick,
  onValueChange,
  onSave,
  onClear,
  onCancel,
}) => (
  <DashboardCardWrapper
    id="sleep"
    isDone={isDone}
    onToggle={onToggle}
    className="md:col-span-6 xl:col-span-3"
  >
    <SleepCard
      density={density}
      sleepHours={sleep}
      isEditing={isEditing}
      tempValue={tempValue}
      onCardClick={onCardClick}
      onValueChange={onValueChange}
      onSave={onSave}
      onClear={onClear}
      onCancel={onCancel}
    />
  </DashboardCardWrapper>
);

// Alcohol Card Wrapper
interface DashboardAlcoholCardProps {
  isDone: boolean;
  onToggle: (id: string, e: React.MouseEvent) => void;
  density: string;
  alcohol: number;
  alcoholLimit?: number;
  isEditing: boolean;
  tempValue: string;
  onCardClick: () => void;
  onValueChange: (val: string) => void;
  onSave: () => void;
  onKeyDown: (e: React.KeyboardEvent) => void;
  onAlcoholClick: (count: number) => void;
}

export const DashboardAlcoholCard: React.FC<DashboardAlcoholCardProps> = ({
  isDone,
  onToggle,
  density,
  alcohol,
  alcoholLimit,
  isEditing,
  tempValue,
  onCardClick,
  onValueChange,
  onSave,
  onKeyDown,
  onAlcoholClick,
}) => (
  <DashboardCardWrapper
    id="alcohol"
    isDone={isDone}
    onToggle={onToggle}
    className="md:col-span-6 xl:col-span-3"
  >
    <AlcoholCard
      density={density}
      alcoholCount={alcohol}
      alcoholLimit={alcoholLimit}
      isEditing={isEditing}
      tempValue={tempValue}
      onCardClick={onCardClick}
      onValueChange={onValueChange}
      onSave={onSave}
      onKeyDown={onKeyDown}
      onAlcoholClick={onAlcoholClick}
    />
  </DashboardCardWrapper>
);

// Water Card Wrapper
interface DashboardWaterCardProps {
  isDone: boolean;
  onToggle: (id: string, e: React.MouseEvent) => void;
  density: string;
  water: number;
  waterGoal: number;
  isEditing: boolean;
  tempValue: string;
  onCardClick: () => void;
  onValueChange: (val: string) => void;
  onSave: () => void;
  onKeyDown: (e: React.KeyboardEvent) => void;
  onWaterClick: (count: number) => void;
}

export const DashboardWaterCard: React.FC<DashboardWaterCardProps> = ({
  isDone,
  onToggle,
  density,
  water,
  waterGoal,
  isEditing,
  tempValue,
  onCardClick,
  onValueChange,
  onSave,
  onKeyDown,
  onWaterClick,
}) => (
  <DashboardCardWrapper
    id="water"
    isDone={isDone}
    onToggle={onToggle}
    className="md:col-span-6 xl:col-span-3"
  >
    <WaterCard
      density={density}
      waterCount={water}
      waterGoal={waterGoal}
      isEditing={isEditing}
      tempValue={tempValue}
      onCardClick={onCardClick}
      onValueChange={onValueChange}
      onSave={onSave}
      onKeyDown={onKeyDown}
      onWaterClick={onWaterClick}
    />
  </DashboardCardWrapper>
);

// Caffeine Card Wrapper
interface DashboardCaffeineCardProps {
  isDone: boolean;
  onToggle: (id: string, e: React.MouseEvent) => void;
  density: string;
  caffeine: number;
  caffeineLimit: number;
  isEditing: boolean;
  tempValue: string;
  onCardClick: () => void;
  onValueChange: (val: string) => void;
  onSave: () => void;
  onCancel: () => void;
  onKeyDown: (e: React.KeyboardEvent) => void;
  onQuickAdd: (amount: number, type: "coffee" | "nocco") => void;
}

export const DashboardCaffeineCard: React.FC<DashboardCaffeineCardProps> = ({
  isDone,
  onToggle,
  density,
  caffeine,
  caffeineLimit,
  isEditing,
  tempValue,
  onCardClick,
  onValueChange,
  onSave,
  onCancel,
  onKeyDown,
  onQuickAdd,
}) => (
  <DashboardCardWrapper
    id="caffeine"
    isDone={isDone}
    onToggle={onToggle}
    className="md:col-span-6 xl:col-span-3"
  >
    <CaffeineCard
      density={density}
      caffeineLimit={caffeineLimit}
      currentCaffeine={caffeine}
      isEditing={isEditing}
      tempValue={tempValue}
      onCardClick={onCardClick}
      onValueChange={onValueChange}
      onSave={onSave}
      onCancel={onCancel}
      onKeyDown={onKeyDown}
      onQuickAdd={onQuickAdd}
    />
  </DashboardCardWrapper>
);
