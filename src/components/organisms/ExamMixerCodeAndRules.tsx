"use client";

import { Input, Select, Textarea } from "@/components/atoms";
import { FormField } from "@/components/molecules";
import { buildCodeList, parseCustomCodes } from "@/lib/logic/docx/generate";

export interface CodeSettings {
  mode: "auto" | "custom";
  variantCount: number;
  firstCode: string;
  codeStep: number;
  fourDigits: boolean;
  customCodes: string;
}

export interface MixRules {
  shuffleChoices: boolean;
  dontShuffleTF: boolean;
  renumber: boolean;
  outputStyle: "keep" | "standard";
  englishBlockMode: boolean;
  autoDetectAnswers: boolean;
  removeSolutions: boolean;
  groupSizes: string;
}

export interface FixedItems {
  fixedAllTFItems: boolean;
  fixedQuestionNums: string;
  fixedSpecificTFItems: boolean;
  fixedTFItems: string;
}

export const DEFAULT_CODE_SETTINGS: CodeSettings = {
  mode: "auto",
  variantCount: 4,
  firstCode: "101",
  codeStep: 1,
  fourDigits: false,
  customCodes: "",
};

export const DEFAULT_MIX_RULES: MixRules = {
  shuffleChoices: true,
  dontShuffleTF: false,
  renumber: true,
  outputStyle: "keep",
  englishBlockMode: true,
  autoDetectAnswers: true,
  removeSolutions: false,
  groupSizes: "",
};

export const DEFAULT_FIXED_ITEMS: FixedItems = {
  fixedAllTFItems: false,
  fixedQuestionNums: "",
  fixedSpecificTFItems: false,
  fixedTFItems: "",
};

export function resolveCodes(settings: CodeSettings): string[] {
  if (settings.mode === "custom") return parseCustomCodes(settings.customCodes);
  return buildCodeList(settings);
}

// Mirrors legacy's Step card 2 "TẠO MÃ ĐỀ" (3363-3384) and Step card 3
// "QUY TẮC TRỘN" (3386-3445), including the "📌 Cố định ý/chuẩn hóa tài liệu" block.
export function ExamMixerCodeAndRules({
  code,
  onCodeChange,
  rules,
  onRulesChange,
  fixed,
  onFixedChange,
}: {
  code: CodeSettings;
  onCodeChange: (next: CodeSettings) => void;
  rules: MixRules;
  onRulesChange: (next: MixRules) => void;
  fixed: FixedItems;
  onFixedChange: (next: FixedItems) => void;
}) {
  const preview = resolveCodes(code);

  return (
    <div className="flex flex-col gap-4">
      <div className="rounded-[14px] border border-border bg-panel-2 p-4">
        <h3 className="mb-3 text-sm font-bold text-text">Mã đề</h3>
        <div className="mb-3 flex flex-wrap gap-4 text-sm text-text">
          <label className="flex items-center gap-2">
            <input
              type="radio"
              name="codeMode"
              checked={code.mode === "auto"}
              onChange={() => onCodeChange({ ...code, mode: "auto" })}
            />
            Tự động (mã đầu + bước nhảy)
          </label>
          <label className="flex items-center gap-2">
            <input
              type="radio"
              name="codeMode"
              checked={code.mode === "custom"}
              onChange={() => onCodeChange({ ...code, mode: "custom" })}
            />
            Tự chọn mã đề (không theo quy luật)
          </label>
        </div>

        {code.mode === "auto" ? (
          <div className="grid gap-3 sm:grid-cols-4">
            <FormField label="Số mã đề">
              <Input
                type="number"
                min={1}
                max={50}
                value={code.variantCount}
                onChange={(e) => onCodeChange({ ...code, variantCount: Number(e.target.value) || 1 })}
              />
            </FormField>
            <FormField label="Mã đầu">
              <Input value={code.firstCode} onChange={(e) => onCodeChange({ ...code, firstCode: e.target.value })} />
            </FormField>
            <FormField label="Bước nhảy">
              <Input
                type="number"
                min={1}
                value={code.codeStep}
                onChange={(e) => onCodeChange({ ...code, codeStep: Number(e.target.value) || 1 })}
              />
            </FormField>
            <label className="flex items-end gap-2 pb-2 text-sm text-text">
              <input
                type="checkbox"
                checked={code.fourDigits}
                onChange={(e) => onCodeChange({ ...code, fourDigits: e.target.checked })}
              />
              4 chữ số
            </label>
          </div>
        ) : (
          <FormField label="Danh sách mã đề (phân tách bằng dấu phẩy hoặc xuống dòng)">
            <Textarea
              rows={3}
              value={code.customCodes}
              onChange={(e) => onCodeChange({ ...code, customCodes: e.target.value })}
            />
          </FormField>
        )}

        <p className="mt-3 text-xs text-muted">Xem trước: {preview.join(", ") || "(chưa có mã đề)"}</p>
      </div>

      <div className="rounded-[14px] border border-border bg-panel-2 p-4">
        <h3 className="mb-3 text-sm font-bold text-text">Quy tắc trộn</h3>
        <div className="flex flex-wrap gap-4 text-sm text-text">
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={rules.shuffleChoices}
              onChange={(e) => onRulesChange({ ...rules, shuffleChoices: e.target.checked })}
            />
            Đảo A–D
          </label>
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={!rules.dontShuffleTF}
              onChange={(e) => onRulesChange({ ...rules, dontShuffleTF: !e.target.checked })}
            />
            Đảo ý Đúng/Sai
          </label>
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={rules.renumber}
              onChange={(e) => onRulesChange({ ...rules, renumber: e.target.checked })}
            />
            Đánh lại số câu
          </label>
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={rules.removeSolutions}
              onChange={(e) => onRulesChange({ ...rules, removeSolutions: e.target.checked })}
            />
            Ẩn đáp án/lời giải
          </label>
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={rules.autoDetectAnswers}
              onChange={(e) => onRulesChange({ ...rules, autoDetectAnswers: e.target.checked })}
            />
            Tự nhận đáp án
          </label>
        </div>

        <label className="mt-3 flex items-start gap-2 text-sm text-text">
          <input
            type="checkbox"
            className="mt-0.5"
            checked={rules.englishBlockMode}
            onChange={(e) => onRulesChange({ ...rules, englishBlockMode: e.target.checked })}
          />
          <span>
            🇬🇧 Đề Tiếng Anh – trộn theo KHỐI
            <br />
            <span className="text-xs text-muted">
              Giữ nguyên các khối Reading/Advertisement/Blog/Cloze/Arrangement khi đảo câu, chỉ đảo trong đúng khối.
            </span>
          </span>
        </label>

        <FormField label="Trộn phần I theo nhóm (NB, TH, VD)" className="mt-3">
          <Input value={rules.groupSizes} onChange={(e) => onRulesChange({ ...rules, groupSizes: e.target.value })} />
        </FormField>

        <FormField label="Định dạng đầu ra" className="mt-3">
          <Select
            value={rules.outputStyle}
            onChange={(e) => onRulesChange({ ...rules, outputStyle: e.target.value as "keep" | "standard" })}
          >
            <option value="keep">Giữ định dạng đề gốc</option>
            <option value="standard">Tạo đề chuẩn</option>
          </Select>
        </FormField>
      </div>

      <div className="rounded-[14px] border border-border bg-panel-2 p-4">
        <h3 className="mb-3 text-sm font-bold text-text">📌 Cố định ý/chuẩn hóa tài liệu</h3>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="flex items-center gap-2 text-sm text-text">
              <input
                type="checkbox"
                checked={fixed.fixedAllTFItems}
                onChange={(e) => onFixedChange({ ...fixed, fixedAllTFItems: e.target.checked })}
              />
              Cố định toàn bộ ý trong câu
            </label>
            <FormField label="Danh sách câu, ví dụ: II:5, 12" className="mt-2">
              <Input
                value={fixed.fixedQuestionNums}
                onChange={(e) => onFixedChange({ ...fixed, fixedQuestionNums: e.target.value })}
              />
            </FormField>
          </div>
          <div>
            <label className="flex items-center gap-2 text-sm text-text">
              <input
                type="checkbox"
                checked={fixed.fixedSpecificTFItems}
                onChange={(e) => onFixedChange({ ...fixed, fixedSpecificTFItems: e.target.checked })}
              />
              Cố định một số ý trong câu
            </label>
            <FormField label="Danh sách ý, ví dụ: II:5:a, 12:b" className="mt-2">
              <Input
                value={fixed.fixedTFItems}
                onChange={(e) => onFixedChange({ ...fixed, fixedTFItems: e.target.value })}
              />
            </FormField>
          </div>
        </div>
      </div>
    </div>
  );
}
