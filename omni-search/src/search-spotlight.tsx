import { userInfo } from "os";

import { getPreferenceValues } from "@raycast/api";
import * as React from "react";

import spotlight from "./libs/node-spotlight";
import { SpotlightSearchPreferences, SpotlightSearchResult } from "./types";
import { safeSearchScope } from "./utils";

const folderSpotlightSearchAttributes = [
  "kMDItemDisplayName",
  "kMDItemFSCreationDate",
  "kMDItemFSName",
  "kMDItemFSSize",
  "kMDItemPath",
  "kMDItemContentModificationDate",
  "kMDItemKind",
  "kMDItemContentType",
  "kMDItemLastUsedDate",
  "kMDItemUseCount",
];

const searchSpotlight = (
  search: string,
  searchScope: string,
  abortable: React.MutableRefObject<AbortController | null | undefined> | undefined,
  callback: (result: SpotlightSearchResult) => void
): Promise<void> => {
  const { maxResults } = getPreferenceValues<SpotlightSearchPreferences>();
  const isExactSearch = search.startsWith("[") && search.endsWith("]");

  return new Promise((resolve, reject) => {
    const customScope = searchScope === "pinned" ? "pinned" : userInfo().homedir;
    const customContentType =
      searchScope === "files"
        ? "kMDItemContentType!='public.folder'"
        : searchScope === "folders"
        ? "kMDItemContentType=='public.folder'"
        : "";

    const spotlightSearchAttributes: string[] = folderSpotlightSearchAttributes;
    const searchFilter = [
      ...(customContentType ? [customContentType] : []),
      isExactSearch
        ? `kMDItemDisplayName == '${search.replace(/[[|\]]/gi, "")}'`
        : `kMDItemDisplayName = "*${search}*"cd`,
      // Add sorting by last used date (most recent first)
      "kMDItemLastUsedDate > 0", // Only include items that have been used
    ];

    let resultsCount = 0;

    spotlight(search, safeSearchScope(customScope), searchFilter, spotlightSearchAttributes as [], abortable)
      .on("data", (result: SpotlightSearchResult) => {
        if (resultsCount < maxResults) {
          // keep emitting the match and
          // incr resultsCount (since a folder was found)
          resultsCount++;
          callback(result);
        } else if (resultsCount >= maxResults) {
          // bail/abort on results >= maxResults
          abortable?.current?.abort();

          // allow results to stabilize via usePromise()
          // for onData()
          setTimeout(() => {
            resolve();
          }, 0);
        }

        // keep searching...
      })
      .on("error", (e: Error) => {
        reject(e);
      })
      .on("end", () => {
        resolve();
      });
  });
};

export { searchSpotlight };
