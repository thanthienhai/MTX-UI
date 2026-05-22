# MediaMTX Dashboard – Project Roadmap

> Based on [GitHub Discussion #5128](https://github.com/bluenviron/mediamtx/discussions/5128) and community feedback.

## The Vision

Evolve `mediamtx-dashboard` from a standalone tool into a seamlessly integrated, first‑class web interface for MediaMTX.

> *"In the future we can integrate the web UI directly into the server."* – MediaMTX Maintainer

---

## ✅ Phase 1: Foundation
*Lay the groundwork for a robust and reliable dashboard.*

| Task | Status | Priority |
|------|--------|----------|
| Establish base Next.js + TypeScript architecture | ✅ Complete | High |
| Implement core stream monitoring (active paths, bitrates) | ✅ Complete | High |
| Set up Docker and Docker Compose for development/production | ✅ Complete | Medium |
| Integrate Prometheus + Grafana monitoring stack | ✅ Complete | Medium |
| Provide basic configuration management UI | ✅ Complete | High |

---

## 🚀 Phase 2: Persistence & Configuration
*Solve the critical challenge of making dashboard changes survive server restarts.*

| Task | Status | Priority |
|------|--------|----------|
| Implement YAML config backup before writes | 🔄 In Progress | Critical |
| Enable saving API‑added paths to persistent storage | 🔄 In Progress | Critical |
| Add config restore/rollback UI | ⏳ Planned | High |
| Implement configuration wizard for first‑time users | ⏳ Planned | Medium |

> *"A function exists, to build a json in the scheme of the configuration yaml. but no disk write is available at the moment. for that, i want a workflow to backup the config before writing the new one on disk."* – mediamtx‑ui developer

---

## 🔐 Phase 3: Authentication & Authorization
*Add secure access controls.*

| Task | Status | Priority |
|------|--------|----------|
| Integrate with MediaMTX's internal user database | ⏳ Planned | High |
| Implement login screen and session management | ⏳ Planned | High |
| Add role‑based access control (Admin vs. Viewer) | ⏳ Planned | Medium |
| Restrict stream access by user role | ⏳ Planned | Medium |

---

## 🎬 Phase 4: In‑Dashboard Video Player
*Enable users to view streams directly within the dashboard.*

| Task | Status | Priority |
|------|--------|----------|
| Research optimal player (hls.js / video.js / WebRTC) | ⏳ Planned | High |
| Implement single‑stream viewing modal | ⏳ Planned | High |
| Add multi‑stream NVR‑style grid view | ⏳ Planned | Medium |
| Support WebRTC for ultra‑low latency viewing | ⏳ Planned | Low |

---

## 🔌 Phase 5: Full MediaMTX Integration
*Work toward being the official web UI bundled with MediaMTX.*

| Task | Status | Priority |
|------|--------|----------|
| Support editing of ALL global config properties | ⏳ Planned | High |
| Support path defaults and user configuration UI | ⏳ Planned | High |
| Align with MediaMTX's unified HTTP service architecture | ⏳ Planned | High |
| Package dashboard as single‑file embeddable asset | ⏳ Planned | Medium |

> *"The reason why i'm not working on that right now is that i'd first like to unify all HTTP-based services into a single one... After this, the UI is the next step."* – MediaMTX Maintainer

---

## 🌟 Phase 6: Advanced Features & Polish
*Add advanced functionality and improve user experience.*

| Task | Status | Priority |
|------|--------|----------|
| Add stream recording management UI | ⏳ Planned | Medium |
| Implement WebHook event viewer | ⏳ Planned | Low |
| Add dark/light theme toggle | ⏳ Planned | Low |
| Internationalization (i18n) support | ⏳ Planned | Low |
| Create comprehensive user documentation | ⏳ Planned | Medium |

---

## 📅 Milestones & Timeline

| Milestone | Target | Key Deliverables |
|-----------|--------|------------------|
| **Alpha Release** | Q3 2026 | Working config persistence + basic auth |
| **Beta Release** | Q4 2026 | Full config editing + in‑dashboard player |
| **v1.0 Stable** | Q1 2027 | Production‑ready with all Phase 1‑4 features |
| **Official Integration** | TBD (post MediaMTX v2.0) | Dashboard bundled with MediaMTX binary |

---

## 🤝 Community Contributions Welcome

The following areas are particularly open for contribution:

- **Video player integration** – Help select and implement the best streaming player
- **RBAC implementation** – Design and code role‑based access controls
- **Testing** – Write unit and integration tests for the dashboard
- **Documentation** – Improve user guides and API documentation

> *"I appreciate your insights on the project. As we work towards consolidating all HTTP-based services under a unified structure, I wish to take a small step in this journey by contributing to the integration of the web UI within the server. I look forward to collaborating on this initiative."* – SIPVY Thân Thiện

---

## 📍 Tracking Progress

- [GitHub Projects](https://github.com/thanthienhai/MTX-UI/projects) – Milestones and task tracking
- [Open Collective](https://opencollective.com/mediamtx-dashboard) – Project sponsorship and funding
- [Discussion #5128](https://github.com/bluenviron/mediamtx/discussions/5128) – Original integration conversation

---

*Last updated: April 2026*