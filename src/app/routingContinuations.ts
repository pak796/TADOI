import type { LeftRailMenuItem } from "../components/LeftRail";
import type { UITaskEditorUnsavedContinuation } from "../ui/state";

export function resolveTaskEditorContinuationForLeftRail(
  item: LeftRailMenuItem
): UITaskEditorUnsavedContinuation | null {
  switch (item) {
    case "LIST":
      return "open_list";
    case "DASHBOARD":
      return "open_dashboard";
    case "BACKUP":
      return "open_backup_center";
    case "NOTES":
      return "open_notes";
    case "ADD":
      return "open_add";
    case "EDIT":
      return "open_edit";
    case "SEARCH":
      return "open_search";
    case "TAG_PANEL":
      return "open_tag_filter_panel";
    case "HELP":
      return "open_help";
    case "DELETE":
      return "open_delete_confirm";
    default:
      return null;
  }
}

export function describeTaskEditorContinuation(
  continuation: UITaskEditorUnsavedContinuation
): string {
  switch (continuation) {
    case "close_editor":
    case "open_list":
      return "return to list";
    case "open_dashboard":
      return "open dashboard";
    case "open_backup_center":
      return "open Backup Center";
    case "open_notes":
      return "open TOME";
    case "open_search":
      return "open search";
    case "open_help":
      return "open help";
    case "open_add":
      return "open Add";
    case "open_edit":
      return "open Edit";
    case "open_tag_filter_panel":
      return "open tag panel";
    case "open_delete_confirm":
      return "open delete confirmation";
    default:
      return "continue";
  }
}
