# SpirChat

منصّة **دردشة مباشرة + شات بوت** موجّهة للسوق العربي: صندوق وارد موحّد يجمع محادثات الموقع وواتساب وإنستغرام وفيسبوك وتيليجرام وغيرها، مع منشئ تدفّقات مرئي، وذكاء اصطناعي، وحملات تسويقية، وفريق دعم بصلاحيات.
البديل العربي لـ Tidio وManyChat وChatwoot.

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

> الواجهة ثنائية اللغة (عربي/إنجليزي) مع دعم RTL كامل، والأرقام في الواجهة لاتينية دائماً.

---

## المحتويات

1. [الميزات](#الميزات)
2. [القنوات المدعومة](#القنوات-المدعومة)
3. [البنية المعمارية](#البنية-المعمارية)
4. [التقنيات](#التقنيات)
5. [التشغيل محلياً](#التشغيل-محلياً)
6. [متغيّرات البيئة](#متغيّرات-البيئة)
7. [المهام المجدولة (Cron)](#المهام-المجدولة-cron)
8. [ودجت الموقع](#ودجت-الموقع)
9. [الـ API العامة والـ Webhooks](#الـ-api-العامة-والـ-webhooks)
10. [هيكل المشروع](#هيكل-المشروع)
11. [أين أجد كل ميزة؟](#أين-أجد-كل-ميزة)
12. [قاعدة البيانات والهجرات](#قاعدة-البيانات-والهجرات)
13. [نموذج الأمان](#نموذج-الأمان)
14. [دورة التطوير](#دورة-التطوير)
15. [ملفات توثيق أخرى](#ملفات-توثيق-أخرى)

---

## الميزات

### صندوق الوارد (Inbox)
- وارد موحّد لكل القنوات، **تحديث حيّ** (Supabase Realtime) مع اكتشاف انقطاع الاتصال وإعادة الاتصال تلقائياً.
- حضور الفريق (من متصل الآن)، مؤشّر «يكتب…» للزائر والوكيل، وحالة «بعيد» للوكيل.
- تعيين المحادثات يدوياً أو تلقائياً (Round-robin مع حدّ أقصى لكل وكيل)، والأولوية (عادي/مرتفع/عاجل)، والتأجيل (Snooze)، والإغلاق التلقائي للمحادثات الخاملة.
- ملاحظات داخلية مع إشارات `@mention`، وتصنيفات (Labels) وقواعد تصنيف تلقائي بالكلمات المفتاحية.
- ردود محفوظة، ماكروز (مجموعة إجراءات بنقرة)، مساعد كتابة بالذكاء الاصطناعي، بحث في الرسائل، وطرق عرض محفوظة.
- إجراءات جماعية (أرشفة، تعليم كمقروء)، وعدّاد غير المقروء في عنوان تبويب المتصفح، وتصدير نص المحادثة.
- إشعارات Web Push للوكلاء.

### جهات الاتصال (CRM)
- وسوم، حقول مخصّصة، اسم الشركة، ملاحظات على مستوى جهة الاتصال، خطّ زمني للنشاط.
- دمج جهات الاتصال المكرّرة، **حذف نهائي وفق GDPR**، واستيراد/تصدير CSV.
- شرائح جمهور (Segments) بمحرّك قواعد.

### الأتمتة
- **منشئ تدفّقات مرئي** (React Flow): محفّزات، رسائل غنية (أزرار/بطاقات)، شروط، تأخير، طلبات HTTP، ردّ بالذكاء الاصطناعي، تحويل لبشري، تقسيم A/B، والتسجيل في سلسلة. مع سجلّ إصدارات ومحاكي اختبار.
- **سلاسل (Sequences)**: رسائل متتابعة بجدول زمني، ويمكن التسجيل فيها تلقائياً عند إضافة وسم.
- **أتمتة إنستغرام**: الردّ على التعليقات برسالة خاصة (Comment→DM) مع شرط المتابعة.
- **ساعات العمل** مع ردّ تلقائي خارج الدوام، ومتابعة تلقائية للزائر الذي توقّف عن الرد.
- **ردود ذكاء اصطناعي** من مقالات مركز المساعدة، وتصنيف المحادثات بالذكاء الاصطناعي.

### التسويق
- **Broadcasts**: رسائل جماعية على القنوات الاجتماعية.
- **Campaigns**: حملات بريد/SMS/واتساب لجهات الاتصال، مع جدولة واختبار A/B وتقرير لكل مستلم.
- **Outreach (الحملات المباشرة)**: إرسال فوري أو مجدول لقائمة أرقام أو بريد ملصوقة أو مرفوعة، مع قوالب واتساب الرسمية (Header/أزرار)، ومعاينة حيّة على شكل محادثة واتساب، وشريط تقدّم، ورسم دائري للتسليم، وإعادة إرسال للفاشلين.
- مزوّدو الحملات (Resend / Twilio / Telegram) يُضبطون **لكل مساحة عمل من داخل التطبيق**، وتُشفَّر الأسرار.
- روابط متتبَّعة مع إحصاءات النقرات، ونماذج محادثة (Forms)، وأدوات نموّ (روابط بدء محادثة).

### الموقع والدعم الذاتي
- **ودجت دردشة للموقع** بسطر واحد، يدعم المرفقات والرسائل الغنية والنماذج.
- **مركز مساعدة** (قاعدة معرفة) بصفحات عامة.
- **استبيان رضا العملاء (CSAT)** يُرسل تلقائياً عند إغلاق المحادثة (عند تفعيله من الإعدادات).

### التقارير
- لوحة رئيسية (نشاط 7 أيام، الفريق المتصل، حالة القنوات)، وتحليلات، وتقارير أداء الوكلاء، وحلقة توزيع حالات المحادثات.
- تقارير روابط قابلة للمشاركة العامة، وتقرير أسبوعي بالبريد.

### الفريق والإدارة
- مساحات عمل متعدّدة، دعوات أعضاء، أدوار (owner / admin / member).
- **فتح/إغلاق حساب عضو**، مُطبَّق على مستوى قاعدة البيانات لا الواجهة فقط.
- سجلّ تدقيق (Audit log) للإجراءات الحسّاسة.
- مفاتيح API وWebhooks صادرة للمطوّرين، وتكاملات Shopify / WooCommerce لعرض طلبات العميل.
- تسجيل دخول بالبريد وGoogle وFacebook، واستعادة كلمة المرور، وشاشة إعداد أولى (Onboarding).

---

## القنوات المدعومة

| القناة | طريقة الربط | مكان تخزين الرسائل |
|---|---|---|
| موقع الويب | ودجت SpirChat | Supabase |
| واتساب (رسمي) | Meta WhatsApp Cloud API: تسجيل مضمَّن (Embedded Signup) أو إدخال يدوي | Supabase |
| إنستغرام، فيسبوك، تيليجرام، X، Bluesky، Reddit | [Zernio](https://zernio.com) (OAuth + إرسال) | Zernio API |
| إنستغرام (تعليقات → رسائل خاصة) | Meta Graph API مباشرة | `comment_logs` + طابور إعادة المحاولة `dm_jobs` |
| بريد / SMS / واتساب Twilio / تيليجرام | للحملات فقط (Resend، Twilio، بوابة Telegram) | `campaign_recipients` / `outreach_recipients` |

> ملاحظة: Zernio كان اسمه سابقاً **Late**، لذلك تجد أعمدة مثل `late_account_id` ومسار الويبهوك `/api/webhooks/late`.

---

## البنية المعمارية

```
                    ┌──────────── المتصفح ────────────┐
                    │ لوحة التحكم (Inbox, Flows, CRM…) │
                    │ ودجت الموقع (iframe)            │
                    └───────────────┬─────────────────┘
                                    │
                      Next.js 16 App Router (Vercel)
   ┌──────────────┬───────────────┼────────────────┬───────────────┐
 Server Actions  /api/v1       /api/widget        /api/webhooks    /api/cron
 (lib/actions)  (جلسة المستخدم) (عامة للودجت)    late·meta·whatsapp  jobs·sequences·meta
   │              │               │                │               │
   └──────────────┴──────┬────────┴────────────────┴───────────────┘
                         │
     ┌───────────────────┼─────────────────────┬──────────────────┐
  Supabase           Flow Engine            Zernio API       Meta Graph /
 (Postgres+RLS,     (lib/flow-engine)      (6 منصّات)       WhatsApp Cloud,
  Auth, Realtime)                                            Resend, Twilio, AI
```

### مسار الرسالة الواردة
1. يصل الحدث إلى webhook القناة (`/api/webhooks/late`, `/whatsapp`, `/meta`) أو إلى نقاط الودجت (`/api/widget/[channelId]/messages`).
2. يُتحقَّق من التوقيع/الرمز. أحداث Zernio يُسجَّل معرّفها في `webhook_events` لمنع المعالجة المكرّرة عند إعادة الإرسال.
3. تُنشأ جهة الاتصال والمحادثة أو تُحدَّثان، ثم تُطبَّق بحسب القناة: التعيين التلقائي، التصنيف التلقائي، ردّ خارج الدوام، تصنيف الذكاء الاصطناعي، إشعار Push، وWebhook صادر.
4. يُطابَق المحفّز (`matchTrigger`) ويُشغَّل التدفّق (`executeFlow`). الخطوات المؤجّلة تُحفظ في `scheduled_jobs` ويكملها الـ Cron.
5. يظهر التحديث في الوارد لحظياً عبر Realtime.

### عُقد منشئ التدفّقات
`sendMessage` · `aiResponse` · `condition` · `delay` · `smartDelay` (انتظار ردّ أو مهلة) · `addTag` / `removeTag` · `setCustomField` · `httpRequest` · `goToFlow` · `humanTakeover` · `enrollSequence` · `subscribe` / `unsubscribe` · `abSplit` · `commentReply` · `privateReply`. التنفيذ في `lib/flow-engine/engine.ts`.

### مسار الرسالة الصادرة
- ردّ الوكيل: `POST /api/v1/messages`، أو `sendConversationMessage()` في `lib/outbound.ts` الذي يختار القناة الصحيحة تلقائياً.
- واتساب: `lib/whatsapp-cloud.ts`، وإيصالات التسليم والقراءة تُحدِّث حالة الرسالة (✓✓ الزرقاء).

---

## التقنيات

| الطبقة | الأداة |
|---|---|
| الإطار | Next.js 16 (App Router, Turbopack) · React 19 · TypeScript |
| الواجهة | Tailwind CSS 4 (RTL بخصائص منطقية) · lucide-react · simple-icons |
| قاعدة البيانات / المصادقة / الوقت الحقيقي | Supabase (Postgres + RLS + Auth + Realtime) |
| منشئ التدفّقات | React Flow (`@xyflow/react`) |
| الذكاء الاصطناعي | Vercel AI SDK + AI Gateway (أو مفتاح لكل مساحة عمل) |
| المراسلة | Zernio · Meta WhatsApp Cloud API · Meta Graph API |
| الحملات | Resend (بريد) · Twilio (SMS/واتساب) · بوابة Telegram (GramJS) |
| الإشعارات | Web Push (`web-push`, VAPID) |
| الاختبارات | Vitest |
| الاستضافة | Vercel |

---

## التشغيل محلياً

**المتطلّبات:** Node.js 20+، ومشروع [Supabase](https://supabase.com) (الخطة المجانية تكفي).

```bash
git clone https://github.com/inzohussein-blip/spir-chat.git
cd spir-chat
npm install
cp .env.example .env    # ثم املأ القيم (انظر القسم التالي)
```

**إعداد قاعدة البيانات:** افتح Supabase → **SQL Editor**، والصق محتوى [`supabase/schema.sql`](./supabase/schema.sql) وشغّله مرة واحدة. الملف يجمع كل الهجرات بالترتيب.

```bash
npm run dev          # http://localhost:3000
```

سجّل حساباً جديداً، وستُنشأ لك مساحة عمل وتُوجَّه إلى شاشة الإعداد الأولى.

| الأمر | الوظيفة |
|---|---|
| `npm run dev` | خادم التطوير (Turbopack) |
| `npm run build` | بناء الإنتاج |
| `npm test` / `npx vitest run` | الاختبارات |
| `npx tsc --noEmit` | فحص الأنواع |
| `npm run lint` | ESLint |
| `node scripts/smoke-test.mjs <url>` | اختبار شامل: ينشئ تدفّقاً تجريبياً ويرسل webhook محاكى ثم يتحقّق وينظّف |

---

## متغيّرات البيئة

تُضبط في **Vercel → Settings → Environment Variables** للإنتاج، وفي `.env` محلياً. القائمة الكاملة موجودة في [`.env.example`](./.env.example). **لا تضع قيماً سرّية في المستودع.**

### إلزامية
| المتغيّر | الوصف |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | رابط مشروع Supabase |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | المفتاح العام (anon) |
| `SUPABASE_SERVICE_ROLE_KEY` | مفتاح الخدمة (سرّي، للخادم فقط) |
| `NEXT_PUBLIC_APP_URL` | رابط التطبيق العام |
| `CRON_SECRET` | سرّ حماية نقاط الـ Cron |

### اختيارية (حسب الميزة)
| الميزة | المتغيّرات |
|---|---|
| واتساب Cloud API | `META_APP_ID`, `META_APP_SECRET`, `META_WHATSAPP_TOKEN`, `META_PHONE_NUMBER_ID`, `META_WEBHOOK_VERIFY_TOKEN`, `META_TOKEN_KEY` (64 hex لتشفير الأسرار، يُنصح به: `openssl rand -hex 32`), `META_GRAPH_VERSION`, `META_WORKSPACE_ID` |
| التسجيل المضمَّن لواتساب | `NEXT_PUBLIC_FACEBOOK_APP_ID`, `NEXT_PUBLIC_META_CONFIG_ID` |
| البريد (Resend) | `RESEND_API_KEY`, `CAMPAIGN_FROM_EMAIL` |
| Twilio | `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_SMS_FROM`, `TWILIO_WHATSAPP_FROM` |
| تيليجرام | `TELEGRAM_GATEWAY_URL`, `TELEGRAM_GATEWAY_TOKEN` |
| Web Push | `NEXT_PUBLIC_VAPID_PUBLIC_KEY`, `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT` |
| الذكاء الاصطناعي | `AI_GATEWAY_API_KEY` |
| تتبّع النقرات | `CLICK_HASH_SALT` |

> **مهم:** بدون `META_APP_SECRET` تُرفض كل رسائل واتساب وإنستغرام الواردة (لا نقبل طلبات غير موقَّعة).

> مزوّدو الحملات وواتساب يمكن إدخالهم **من داخل التطبيق لكل مساحة عمل** (الإعدادات، وصفحة واتساب). قيم مساحة العمل لها الأولوية على متغيّرات البيئة.

---

## المهام المجدولة (Cron)

| المسار | الوظيفة |
|---|---|
| `/api/cron/jobs` | طابور `scheduled_jobs` (استكمال التدفّقات المؤجّلة، Broadcasts، الرسائل المجدولة) + الحملات المجدولة + التقرير الأسبوعي + تصعيد SLA + متابعة الزوّار + الإغلاق التلقائي + الـ Outreach المجدول |
| `/api/cron/sequences` | تنفيذ خطوات السلاسل المستحقّة |
| `/api/cron/meta` | تجديد توكنات Meta وتفريغ طابور `dm_jobs` |

خطة **Vercel Hobby** تسمح بتشغيل الـ Cron مرة يومياً فقط، لذلك `vercel.json` مضبوط يومياً. للحصول على معالجة كل دقيقة:
- **Vercel Pro**: غيّر الجداول إلى `* * * * *`.
- **أو مجدول خارجي** (مثل cron-job.org) يستدعي كل مسار كل دقيقة:
  ```bash
  curl -H "Authorization: Bearer $CRON_SECRET" https://<your-app>/api/cron/jobs
  curl -H "Authorization: Bearer $CRON_SECRET" https://<your-app>/api/cron/sequences
  ```

---

## ودجت الموقع

من **لوحة التحكم ← Website** أنشئ ودجت وانسخ الكود:

```html
<script src="https://<your-app>/widget.js" data-spirchat="CHANNEL_ID" async></script>
```

يضيف الكود زرّاً عائماً يفتح `app/widget/[channelId]` داخل iframe. لغة الودجت تتبع متصفّح الزائر أو السمة `data-spirchat-lang`. محادثات الزوّار تُخزَّن في Supabase وتصل إلى الوارد نفسه، والوكلاء يردّون منه مباشرة.

---

## الـ API العامة والـ Webhooks

**المصادقة:** مفتاح API من **لوحة التحكم ← Developers**، يُرسل كـ `Authorization: Bearer <key>`. يُخزَّن الـ hash فقط، والمفتاح يُعرض مرة واحدة.

| الطلب | الوصف |
|---|---|
| `GET /api/public/v1/contacts?limit=&search=` | قائمة جهات الاتصال |
| `POST /api/public/v1/contacts` | إنشاء جهة اتصال |
| `GET /api/public/v1/conversations?status=&limit=` | قائمة المحادثات |

**Webhooks الصادرة** (موقَّعة بـ HMAC): `message.created` · `conversation.created` · `conversation.resolved` · `contact.created`.

---

## هيكل المشروع

```
spir-chat/
├── app/
│   ├── (auth)/                  # login, register, forgot-password, reset, onboarding, suspended
│   ├── (dashboard)/
│   │   ├── layout.tsx           # الهيكل: Sidebar + Topbar + نبض الحضور
│   │   └── dashboard/           # صفحة لكل قسم (inbox, contacts, flows, outreach, whatsapp, settings…)
│   ├── api/
│   │   ├── v1/                  # API داخلية بجلسة المستخدم (channels, flows, messages, broadcasts…)
│   │   ├── public/v1/           # API عامة بمفتاح API
│   │   ├── widget/[channelId]/  # نقاط الودجت العامة (messages, session, presence, form, upload, config)
│   │   ├── webhooks/            # late (Zernio), meta (Instagram), whatsapp (Cloud API)
│   │   ├── cron/                # jobs, sequences, meta
│   │   ├── meta/                # ربط حساب إنستغرام (OAuth)
│   │   └── push/                # اشتراكات Web Push
│   ├── auth/callback/           # رجوع OAuth / البريد
│   ├── widget/[channelId]/      # واجهة الدردشة داخل iframe
│   ├── help/[slug]/             # مركز المساعدة العام
│   ├── csat/[token]/            # صفحة تقييم الرضا
│   ├── reports/[slug]/          # تقارير مشاركة عامة
│   ├── invite/[inviteId]/       # قبول دعوة الفريق
│   └── r/[slug]/                # تحويل الروابط المتتبَّعة
├── components/
│   ├── inbox/                   # conversation-list (Realtime), message-thread, contact-panel…
│   ├── flow-builder/            # canvas, nodes/, panels/
│   ├── contacts/  sequences/  settings/  outreach/  widget/  auth/
│   └── sidebar.tsx, topbar.tsx, workspace-switcher.tsx, i18n-provider.tsx…
├── lib/
│   ├── actions/                 # Server Actions لكل ميزة
│   ├── flow-engine/             # engine, trigger-matcher, platform-adapter, simulator, nodes/
│   ├── campaigns/               # providers (Resend/Twilio/Telegram), send
│   ├── meta/                    # Instagram Graph: client, oauth + تشفير التوكنات, webhook, comments
│   ├── ai/                      # compose, classify, answer
│   ├── i18n/                    # dictionaries (en مصدر، ar مطابق), server, actions
│   ├── supabase/                # server (createClient/createServiceClient), client, middleware
│   ├── types/database.ts        # أنواع كل الجداول
│   ├── workspace.ts             # getWorkspace(): المستخدم + مساحة العمل الحالية
│   └── *.ts                     # منطق نقي مع اختبارات *.test.ts
├── supabase/
│   ├── migrations/              # 00001 → 00079
│   └── schema.sql               # كل الهجرات مجمّعة
├── public/                      # widget.js, sw.js, أيقونات
├── services/telegram-gateway/   # خدمة Node منفصلة لإرسال تيليجرام
└── scripts/smoke-test.mjs
```

---

## أين أجد كل ميزة؟

| الميزة | الصفحة | المنطق |
|---|---|---|
| صندوق الوارد | `dashboard/inbox` | `components/inbox/*`, `lib/actions/conversations.ts` |
| جهات الاتصال | `dashboard/contacts` | `lib/actions/contacts.ts`, `components/contacts/*` |
| التدفّقات | `dashboard/flows` | `lib/flow-engine/*`, `components/flow-builder/*` |
| السلاسل | `dashboard/sequences` | `lib/actions/sequences.ts`, `lib/sequence-processor.ts` |
| أتمتة إنستغرام | `dashboard/ig-automations` | `lib/actions/meta-automations.ts`, `lib/meta/*` |
| الحملات | `dashboard/campaigns` | `lib/campaigns/*`, `lib/actions/campaigns.ts` |
| الحملات المباشرة | `dashboard/outreach` | `lib/actions/outreach.ts`, `lib/outreach*.ts` |
| واتساب | `dashboard/whatsapp` | `lib/whatsapp-cloud.ts`, `lib/actions/whatsapp-connect.ts` |
| الودجت | `dashboard/widgets` | `lib/widget*.ts`, `app/api/widget/*` |
| مركز المساعدة | `dashboard/help-center` | `lib/actions/kb.ts`, `lib/ai/answer.ts` |
| التقارير | `dashboard/reports`, `dashboard/analytics` | `lib/agent-stats.ts`, `lib/volume.ts` |
| الفريق | `dashboard/settings/team` | `lib/actions/team.ts` |
| الإعدادات | `dashboard/settings` | `components/settings/*-section.tsx` |
| المطوّرون | `dashboard/developers` | `lib/api-keys.ts`, `app/api/public/v1/*` |

الخريطة التفصيلية الكاملة (كل ملف ودوره) موجودة في [`CLAUDE.md`](./CLAUDE.md).

---

## قاعدة البيانات والهجرات

- كل تعديل على المخطّط هجرة جديدة مرقّمة في `supabase/migrations/000NN_name.sql`.
- **إضافة عمود أو جدول = 4 خطوات:**
  1. ملف الهجرة.
  2. تحديث `lib/types/database.ts` (Row / Insert / Update).
  3. إلحاق نفس SQL بنهاية `supabase/schema.sql`.
  4. تطبيقها على مشروع Supabase الحيّ والتأكّد منها.
- مشروع التطبيق الحيّ في Supabase اسمه **spirchat**.

---

## نموذج الأمان

- **RLS على كل الجداول.** الوصول مشروط بـ `is_workspace_member(workspace_id)`، والدالة تشترط أن تكون العضوية **نشطة** (`is_active`). العضو المغلق حسابه لا يرى شيئاً حتى عبر API مباشرة.
- **عميلان لـ Supabase:**
  - `createClient()` بجلسة المستخدم، وتُطبَّق عليه RLS.
  - `createServiceClient()` بمفتاح الخدمة، ويُستخدم فقط في الـ Webhooks والـ Cron ونقاط الودجت والـ API العامة، مع تقييد يدوي بـ `workspace_id`.
- دوال `SECURITY DEFINER` المستدعاة عبر RPC تتحقّق من العضوية بنفسها، والدوال الداخلية غير متاحة لـ `anon` و`authenticated` (الهجرات `00076` و`00077`).
- أسرار المزوّدين المخزّنة في القاعدة مشفّرة بـ AES-256-GCM (`encryptToken` / `decryptToken` في `lib/meta/oauth.ts`). المفتاح `META_TOKEN_KEY`، أو مشتقّ من `SUPABASE_SERVICE_ROLE_KEY`، ولا يوجد مفتاح ثابت في الكود. تغيير المفتاح لاحقاً آمن لأن فكّ التشفير يجرّب كل المفاتيح المضبوطة.
- الـ Webhooks الواردة تتحقّق من التوقيع أو رمز التحقّق، وواتساب وإنستغرام **يرفضان أي طلب** إذا لم يُضبط `META_APP_SECRET`. أحداث Zernio لها سجلّ منع تكرار (`webhook_events`).
- مفاتيح API تُخزَّن كـ hash فقط، والـ Webhooks الصادرة موقَّعة بـ HMAC.

---

## دورة التطوير

بعد كل تعديل وقبل كل commit:

```bash
npx tsc --noEmit     # فحص الأنواع
npm run build        # بناء الإنتاج
npx vitest run       # الاختبارات
```

قواعد ثابتة:
- **الترجمة:** `lib/i18n/dictionaries.ts`. الإنجليزية `en` هي المصدر، والعربية `ar` يجب أن تطابق شكلها تماماً وإلا فشل `tsc`.
- **الأرقام في الواجهة لاتينية:** استخدم دائماً `toLocale*("en-US")`.
- **RTL:** استخدم الخصائص المنطقية في Tailwind (`ms-`/`me-`/`ps-`/`pe-`/`start`/`end`).
- المنطق النقي يوضع في `lib/` مع ملف اختبار بجانبه.

---

## ملفات توثيق أخرى

| الملف | المحتوى |
|---|---|
| [`SETUP.md`](./SETUP.md) | دليل الإطلاق: ربط Supabase، واتساب، إنستغرام، الخطة المجانية، النطاق المخصّص |
| [`PRE-LAUNCH.md`](./PRE-LAUNCH.md) | قائمة فحص ما قبل الإطلاق |
| [`PRODUCT.md`](./PRODUCT.md) | تموضع المنتج وخارطة التميّز |
| [`CLAUDE.md`](./CLAUDE.md) | قواعد العمل وخريطة المشروع التفصيلية |
| [`services/telegram-gateway/README.md`](./services/telegram-gateway/README.md) | تشغيل بوابة تيليجرام |

---

## الرخصة والشكر

MIT. SpirChat مبني في الأصل على [ZernFlow](https://github.com/zernio-dev/zernflow) من getlate-dev (رخصة MIT)، وإشعار حقوق النشر الأصلي محفوظ في [`LICENSE`](./LICENSE).
