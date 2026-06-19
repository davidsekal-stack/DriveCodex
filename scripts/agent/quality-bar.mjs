/**
 * quality-bar.mjs — the single canonical definition of what case BELONGS in the
 * RAG database. Shared by BOTH daily audits so they judge against the exact same bar:
 *   - recall-watchdog.mjs   (catches the verifier wrongly REJECTING good cases)
 *   - precision-auditor.mjs (catches the verifier wrongly ACCEPTING bad cases)
 *
 * This is the (a)-(e) definition + the genuine-repairs allowlist ONLY. Each auditor
 * appends its OWN verdict instruction (wrongly_rejected vs wrongly_accepted), so the
 * shared text never leans one direction. Keeping it in one place stops the two
 * audits from drifting apart.
 */
export const QUALITY_BAR = `A case BELONGS in the database only if ALL hold: (a) the vehicle is a passenger car or light van (NOT a motorcycle/truck/etc.); (b) it describes a genuine MALFUNCTION/DEFECT that was actually repaired and confirmed fixed; (c) it is NOT a config/menu question, parts-fitment/where-to-buy, elective upgrade/retrofit/coding, third-party-gadget firmware, "fixed itself", or a preventive-maintenance opinion; (d) the SAME forum user reported the fault AND carried out (or explicitly confirmed) the repair — a fix merely SUGGESTED by another user, or performed by a different user, does NOT qualify (this is a deliberate single-author policy); (e) the case's stated vehicle matches the vehicle in the cited posts, not a different car mentioned elsewhere in a multi-vehicle thread. Genuine repairs INCLUDE cleaning, additive/fluid cures, adjustment, re-flashing the car's OWN ECU, rodent-wiring repair, an emulator that RESTORES a failed factory function, and worn-part replacement on classic cars.`;
