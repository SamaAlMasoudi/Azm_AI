/* Azm — settings: 100% exact match with Extentions/dashboard.html */

"use client";

import { useState } from "react";
import { toast } from "sonner";
import { useAzm } from "@/lib/azm/store";
import * as api from "@/lib/azm/api";
import { Globe, Layers, Bot, AlertTriangle, Trash2, X } from "lucide-react";

function ToggleSwitch({
  checked,
  onChange,
}: {
  checked: boolean;
  onChange: (next: boolean) => void;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={`relative h-[28px] w-[48px] shrink-0 rounded-full border transition-colors ${
        checked
          ? "border-[#8B5CF6] bg-[#7C3AED]"
          : "border-[#A79BC8]/34 bg-[#241946]"
      }`}
    >
      <span
        className={`absolute top-[3px] right-[3px] h-[20px] w-[20px] rounded-full transition-transform ${
          checked ? "-translate-x-[20px] bg-white" : "translate-x-0 bg-[#A79BC8]"
        }`}
      />
    </button>
  );
}

export function SettingsView() {
  const store = useAzm();

  const [simulatedBrowsing, setSimulatedBrowsing] = useState(false);
  const [spaceIsolation, setSpaceIsolation] = useState(true);
  const [smartAgent, setSmartAgent] = useState(true);
  const [clearConfirm, setClearConfirm] = useState(false);

  const serverUrl =
    typeof window !== "undefined" ? window.location.origin : "https://azm-ai.onrender.com";
  const pairingToken = store.profile?.pairingToken ?? "";

  const handleSaveAndTest = async () => {
    try {
      if (pairingToken) {
        await navigator.clipboard.writeText(pairingToken);
      }
      await api.apiGetProfile();
      toast.success("الاتصال بالـ Backend ناجح وتم نسخ رمز الاقتران");
    } catch {
      toast.error("تعذر الاتصال بالخادم");
    }
  };

  const handleClearAll = async () => {
    try {
      await api.apiResetAll();
      await store.resetProfileData();
      toast.success("تم مسح جميع البيانات");
      store.resetDraft();
      await store.loadGroups();
      setClearConfirm(false);
      store.setView("dashboard");
    } catch {
      toast.error("حدث خطأ أثناء مسح البيانات");
    }
  };

  return (
    <div className="flex flex-col gap-[26px]" dir="rtl">
      <header>
        <h1 className="text-[26px] font-extrabold leading-[1.3] text-[#F4F0FC]">الإعدادات</h1>
        <p className="mt-1 text-[15px] text-[#A79BC8]">
          تحكّم في طريقة عمل عزم. تُحفظ التغييرات تلقائيًا.
        </p>
      </header>

      <section className="rounded-[18px] border border-[#A79BC8]/16 bg-[#130C22] px-5 py-1.5">
        {/* ربط Backend عزم */}
        <div className="py-4">
          <div className="flex flex-col gap-0.5">
            <strong className="text-[15px] font-bold text-[#F4F0FC]">ربط Backend عزم</strong>
            <small className="text-[13.5px] text-[#A79BC8]">
              أدخل رابط الخادم ورمز الاقتران من تطبيق عزم. لا تضع أي API Key في الإضافة.
            </small>
          </div>
          <div className="mt-3 flex flex-wrap items-stretch gap-2">
            <input
              readOnly
              value={serverUrl}
              dir="ltr"
              placeholder="http://localhost:3000"
              className="flex-1 min-w-[220px] rounded-[12px] border border-[#A79BC8]/34 bg-[#1A1230] px-3.5 py-2.5 text-[14px] text-[#F4F0FC] outline-none"
            />
            <input
              readOnly
              value={pairingToken}
              dir="ltr"
              type="password"
              placeholder="رمز الاقتران"
              className="flex-1 min-w-[200px] rounded-[12px] border border-[#A79BC8]/34 bg-[#1A1230] px-3.5 py-2.5 text-[14px] text-[#F4F0FC] outline-none"
            />
            <button
              type="button"
              onClick={() => void handleSaveAndTest()}
              className="inline-flex items-center justify-center rounded-[12px] border border-[#A79BC8]/34 bg-transparent px-4 py-2.5 text-sm font-bold text-[#A78BFA] hover:bg-[#8B5CF6]/14 transition-colors"
            >
              حفظ واختبار
            </button>
          </div>
        </div>

        {/* بيئة تصفح محاكاة */}
        <div className="flex items-center justify-between gap-4 border-t border-[#A79BC8]/16 py-4">
          <div className="flex items-center gap-3.5 min-w-0">
            <span className="grid h-[42px] w-[42px] shrink-0 place-items-center rounded-[12px] bg-[#241946] text-[#A78BFA]">
              <Globe size={20} />
            </span>
            <div className="flex flex-col gap-0.5 min-w-0">
              <strong className="text-[15px] font-bold text-[#F4F0FC]">بيئة تصفح محاكاة</strong>
              <small className="text-[13.5px] text-[#A79BC8]">
                تجربة بيئة تصفح تجريبية لاختبار تدخلات عزم دون التأثير على تصفحك المعتاد.
              </small>
            </div>
          </div>
          <ToggleSwitch
            checked={simulatedBrowsing}
            onChange={(v) => {
              setSimulatedBrowsing(v);
              toast.success("تم حفظ الإعداد");
            }}
          />
        </div>

        {/* عزل المساحات */}
        <div className="flex items-center justify-between gap-4 border-t border-[#A79BC8]/16 py-4">
          <div className="flex items-center gap-3.5 min-w-0">
            <span className="grid h-[42px] w-[42px] shrink-0 place-items-center rounded-[12px] bg-[#241946] text-[#A78BFA]">
              <Layers size={20} />
            </span>
            <div className="flex flex-col gap-0.5 min-w-0">
              <strong className="text-[15px] font-bold text-[#F4F0FC]">عزل المساحات</strong>
              <small className="text-[13.5px] text-[#A79BC8]">
                فصل مساحة الدراسة عن بقية تصفحك حتى لا تتداخل الأنشطة.
              </small>
            </div>
          </div>
          <ToggleSwitch
            checked={spaceIsolation}
            onChange={(v) => {
              setSpaceIsolation(v);
              toast.success("تم حفظ الإعداد");
            }}
          />
        </div>

        {/* الوكيل الذكي */}
        <div className="flex items-center justify-between gap-4 border-t border-[#A79BC8]/16 py-4">
          <div className="flex items-center gap-3.5 min-w-0">
            <span className="grid h-[42px] w-[42px] shrink-0 place-items-center rounded-[12px] bg-[#241946] text-[#A78BFA]">
              <Bot size={20} />
            </span>
            <div className="flex flex-col gap-0.5 min-w-0">
              <strong className="text-[15px] font-bold text-[#F4F0FC]">الوكيل الذكي</strong>
              <small className="text-[13.5px] text-[#A79BC8]">
                يقيّم مبرراتك عند الانحراف عن هدفك ويقرر مستوى التدخل المناسب.
              </small>
            </div>
          </div>
          <ToggleSwitch
            checked={smartAgent}
            onChange={(v) => {
              setSmartAgent(v);
              void store.setInterventionLevel(v ? "balanced" : "passive");
              toast.success("تم حفظ الإعداد");
            }}
          />
        </div>
      </section>

      {/* منطقة الخطر */}
      <section className="flex flex-wrap items-center justify-between gap-4 rounded-[18px] border border-[#FB7185]/30 bg-[#130C22] p-5">
        <div>
          <h2 className="flex items-center gap-2 text-[17px] font-bold text-[#FB7185]">
            <AlertTriangle size={19} />
            <span>منطقة الخطر</span>
          </h2>
          <p className="mt-0.5 text-[13.5px] text-[#A79BC8]">
            سيتم حذف الجلسة الجارية والمجموعات والسجل والإحصاءات والإعدادات نهائيًا.
          </p>
        </div>

        <button
          type="button"
          onClick={() => setClearConfirm(true)}
          className="inline-flex items-center gap-2 rounded-[12px] border border-[#FB7185]/50 bg-transparent px-4 py-2.5 text-sm font-bold text-[#FB7185] hover:bg-[#FB7185]/12 transition-colors"
        >
          <Trash2 size={16} />
          <span>مسح كل البيانات</span>
        </button>

        {clearConfirm && (
          <div className="flex w-full flex-col gap-2.5 rounded-[12px] border border-[#FB7185]/40 bg-[#FB7185]/8 p-4">
            <p className="text-sm font-semibold text-[#F4F0FC]">
              هل أنت متأكد؟ لا يمكن التراجع عن هذا الإجراء.
            </p>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => void handleClearAll()}
                className="inline-flex items-center gap-1.5 rounded-[12px] bg-[#FB7185] px-4 py-2 text-sm font-bold text-[#1A0610] hover:bg-[#FDA4AF] transition-colors"
              >
                <Trash2 size={15} />
                <span>نعم، امسح كل شيء</span>
              </button>
              <button
                type="button"
                onClick={() => setClearConfirm(false)}
                className="inline-flex items-center gap-1.5 rounded-[12px] border border-[#A79BC8]/20 bg-transparent px-4 py-2 text-sm font-bold text-[#A79BC8] hover:bg-[#1A1230] hover:text-[#F4F0FC] transition-colors"
              >
                <X size={15} />
                <span>إلغاء</span>
              </button>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}