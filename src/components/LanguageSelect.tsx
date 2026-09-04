import React from "react";
import { LANGUAGES, LangCode, setLanguage } from "../lib/i18n";
import { IconLogo } from "./Icons";

interface LanguageSelectProps {
  onSelect: () => void;
}

export const LanguageSelect: React.FC<LanguageSelectProps> = ({ onSelect }) => {
  const handleSelect = (code: LangCode) => {
    setLanguage(code);
    onSelect();
  };

  return (
    <div className="lang-select-screen">
      <div className="lang-select-card">
        <div className="lang-select-logo">
          <div className="logo-mark logo-mark--lg">
            <IconLogo size={30} />
          </div>
        </div>

        <h1 className="lang-select-title">KeepMeTube</h1>

        <div className="lang-select-grid">
          {LANGUAGES.map((lang) => (
            <button
              key={lang.code}
              className="lang-card"
              onClick={() => handleSelect(lang.code)}
            >
              <span className="lang-card__flag">{lang.flag}</span>
              <span className="lang-card__name">{lang.name}</span>
              {lang.nameEn !== lang.name && (
                <span className="lang-card__name-en">{lang.nameEn}</span>
              )}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};