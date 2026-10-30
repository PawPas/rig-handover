---
name: publish-preview
description: Save a rig page as one self-contained HTML file and put it on a public link for a reviewer, then take the marker off once the review is in. Use for the "preview for review" and "clean up" steps of a plan (ADR 0003).
---

# publish-preview

A reviewer reads a rig page from a copy, not from the lane (ADR 0003). The copy is one static
HTML file on a public host you can upload over later. The page is self-contained (ADR 0001:
inline CSS, no client JS), so a command saves it whole — never a browser's "save as".

Host: a public host you can overwrite, **not** the service repo (ADR 0003 forbids previews in it).
A small separate GitHub repo served by Pages works: push `index.html`, enable Pages, get the link.

## Steps

1. Run rig with the lane marker set (`.env`): `pnpm start`. The page's banner carries the marker.
2. Save the page with a command, e.g. `curl -s http://localhost:8787/digest/<night> > index.html`.
   The file is self-contained; confirm the marker is in it.
3. Put it on a public host you can upload over. With `gh` and Pages:
   ```sh
   gh repo create <owner>/<preview-repo> --public
   cd <preview-repo> && git init && git add index.html && git commit -m "preview" && \
     git branch -M main && git remote add origin <url> && git push -u origin main
   gh api --method POST /repos/<owner>/<preview-repo>/pages -f 'source[branch]=main' -f 'source[path]=/'
   ```
4. **Confirm the link opens for someone else before you send it.** Fetch the public URL until it
   answers 200 with the page, because a page just pushed can still be building.
5. Send the reviewer the link and the plan's issues. The review step stays open until they confirm;
   it blocks the clean-up.

## Clean up (once the review is in)

Only after the reviewer has looked, take the marker off (ADR 0003):

1. Save the page again with `LANE_MARKER` unset (the banner reads "no marker set").
2. Upload it over the **same** link.
3. Confirm the live link no longer shows the marker.

## Don'ts

- Don't put a preview in the service repo, an issue or a chat attachment: there the marker can't
  be taken off again.
- Don't strip the marker before the review is in: the reviewer needs it to tell which lane the
  page came from.
- Don't send a link you haven't opened the way the reviewer will.
