from pathlib import Path
import re
import sys

source = Path(sys.argv[1] if len(sys.argv) > 1 else 'src/template.html').read_text(encoding='utf-8')
pause = re.search(r'<div class="result" id="pause"([^>]*)>', source)
assert pause and 'role="dialog"' in pause.group(1) and 'aria-modal="true"' in pause.group(1), 'pause card must be marked as a modal dialog'
assert 'aria-labelledby="pause-title"' in pause.group(1) and 'id="pause-title"' in source, 'pause dialog must have an accessible name'
assert '[contenteditable]' in source and 'el.tabIndex >= 0' in source, 'dialog focus trap must include all tabbable elements'
assert 'document.activeElement' in source and 'pauseReturnFocus' in source and 'resultReturnFocus' in source and 'restoreDialogFocus' in source, 'dialogs must restore focus to the element that opened them'
trap = source[source.find("document.addEventListener('keydown', e => {", source.find('function setPause')):]
assert re.search(r"e\.key !== 'Tab'[\s\S]*?!dialog\.contains\(document\.activeElement\)[\s\S]*?\.focus\(\)", trap), 'modal dialogs must keep Tab focus inside the open dialog'

assert 'aria-live="off"' in source and 'id="tip-announcement"' in source, 'changing visual tips must not be a live region'
assert re.search(r"function setTip\(text\)[\s\S]*?now - lastTipAnnouncement >= 3000", source), 'tip announcements must be throttled'
assert re.search(r"kind = text\.replace\(/\\b\\d", source), 'tip announcements must omit changing numbers'
assert "keyLabel('KeyE', 'E')" in source and "keyLabel('KeyV', 'V')" in source, 'JavaScript key labels must use the keyboard layout map'
assert re.search(r"\.sort\(\(a, b\) => \(a\.tabIndex === 0 \? Infinity : a\.tabIndex\) - \(b\.tabIndex === 0 \? Infinity : b\.tabIndex\)\)", source), 'focus trap must put positive tabIndex elements before zero-tabIndex elements'
