"use client";

import { useEffect, useMemo, useState } from "react";

import type { TeamBrand } from "@/lib/domain/kbo/types";

type TeamBrandPatchFormProps = {
  teamBrands: TeamBrand[];
  action: (formData: FormData) => void | Promise<void>;
};

export function TeamBrandPatchForm({ teamBrands, action }: TeamBrandPatchFormProps) {
  const [brandId, setBrandId] = useState(teamBrands[0]?.brandId ?? "");
  const selectedBrand = useMemo(
    () => teamBrands.find((brand) => brand.brandId === brandId) ?? teamBrands[0] ?? null,
    [brandId, teamBrands],
  );
  const [displayNameKo, setDisplayNameKo] = useState(selectedBrand?.displayNameKo ?? "");
  const [shortNameKo, setShortNameKo] = useState(selectedBrand?.shortNameKo ?? "");
  const [shortCode, setShortCode] = useState(selectedBrand?.shortCode ?? "");
  const [wordmarkText, setWordmarkText] = useState(selectedBrand?.wordmarkText ?? "");
  const [primaryColor, setPrimaryColor] = useState(selectedBrand?.primaryColor ?? "");
  const [secondaryColor, setSecondaryColor] = useState(selectedBrand?.secondaryColor ?? "");

  useEffect(() => {
    setDisplayNameKo(selectedBrand?.displayNameKo ?? "");
    setShortNameKo(selectedBrand?.shortNameKo ?? "");
    setShortCode(selectedBrand?.shortCode ?? "");
    setWordmarkText(selectedBrand?.wordmarkText ?? "");
    setPrimaryColor(selectedBrand?.primaryColor ?? "");
    setSecondaryColor(selectedBrand?.secondaryColor ?? "");
  }, [selectedBrand]);

  const resetToSelectedBrand = () => {
    setDisplayNameKo(selectedBrand?.displayNameKo ?? "");
    setShortNameKo(selectedBrand?.shortNameKo ?? "");
    setShortCode(selectedBrand?.shortCode ?? "");
    setWordmarkText(selectedBrand?.wordmarkText ?? "");
    setPrimaryColor(selectedBrand?.primaryColor ?? "");
    setSecondaryColor(selectedBrand?.secondaryColor ?? "");
  };

  return (
    <form action={action} className="space-y-3">
      <select
        name="brandId"
        value={brandId}
        onChange={(event) => setBrandId(event.target.value)}
        className="w-full rounded-2xl border border-line/80 bg-white px-4 py-2 text-sm text-ink"
      >
        {teamBrands.map((brand) => (
          <option key={brand.brandId} value={brand.brandId}>
            {brand.displayNameKo} · {brand.brandId}
          </option>
        ))}
      </select>

      {selectedBrand ? (
        <div className="rounded-2xl border border-line/80 bg-slate-50 px-4 py-4 text-sm text-muted">
          <p className="font-medium text-ink">현재 값</p>
          <p className="mt-2">
            {selectedBrand.displayNameKo} · {selectedBrand.shortNameKo} · {selectedBrand.shortCode}
          </p>
          <p className="mt-1">
            {selectedBrand.primaryColor} / {selectedBrand.secondaryColor} · {selectedBrand.wordmarkText}
          </p>
        </div>
      ) : null}

      <div className="grid gap-3 md:grid-cols-2">
        <input
          name="displayNameKo"
          value={displayNameKo}
          onChange={(event) => setDisplayNameKo(event.target.value)}
          placeholder="표시 이름"
          className="rounded-2xl border border-line/80 bg-white px-4 py-2 text-sm text-ink"
        />
        <input
          name="shortNameKo"
          value={shortNameKo}
          onChange={(event) => setShortNameKo(event.target.value)}
          placeholder="짧은 팀 이름"
          className="rounded-2xl border border-line/80 bg-white px-4 py-2 text-sm text-ink"
        />
        <input
          name="shortCode"
          value={shortCode}
          onChange={(event) => setShortCode(event.target.value)}
          placeholder="팀 코드"
          className="rounded-2xl border border-line/80 bg-white px-4 py-2 text-sm text-ink"
        />
        <input
          name="wordmarkText"
          value={wordmarkText}
          onChange={(event) => setWordmarkText(event.target.value)}
          placeholder="워드마크 문구"
          className="rounded-2xl border border-line/80 bg-white px-4 py-2 text-sm text-ink"
        />
        <input
          name="primaryColor"
          value={primaryColor}
          onChange={(event) => setPrimaryColor(event.target.value)}
          placeholder="대표 컬러"
          className="rounded-2xl border border-line/80 bg-white px-4 py-2 text-sm text-ink"
        />
        <input
          name="secondaryColor"
          value={secondaryColor}
          onChange={(event) => setSecondaryColor(event.target.value)}
          placeholder="보조 컬러"
          className="rounded-2xl border border-line/80 bg-white px-4 py-2 text-sm text-ink"
        />
      </div>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        <button type="submit" className="rounded-full bg-accent px-4 py-2 text-sm font-medium text-white">
          브랜드 patch 저장
        </button>
        <button
          type="button"
          onClick={resetToSelectedBrand}
          className="rounded-full border border-line/80 bg-white px-4 py-2 text-sm text-muted"
        >
          현재 값으로 복원
        </button>
      </div>
    </form>
  );
}
