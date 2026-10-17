import { createContext, useContext } from "react";
import { useMediaQuery } from "@mui/material";
import { useTheme } from "@mui/material/styles";

/** Whether this surface may switch to the PC layouts at all. HomePageModals provides
 *  `!isAdmin && !isKiosk`; the default is true so a component rendered on its own (tests)
 *  only needs a wide viewport. */
export const DesktopLayoutAllowedContext = createContext<boolean>(true);

/** True from MUI `md` (900px) up on a surface that allows it. jsdom has no matchMedia, so
 *  tests get the phone path unless they stub it (stubMatchMedia.testutil.ts). */
export function useDesktopLayout(): boolean {
    const allowed = useContext(DesktopLayoutAllowedContext);
    const theme = useTheme();
    const wide = useMediaQuery(theme.breakpoints.up("md"), { noSsr: true });
    return allowed && wide;
}
