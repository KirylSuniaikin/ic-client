import { jest } from "@jest/globals";
import type { BranchMapViewProps } from "../BranchMapView";

// Manual mock (Jest __mocks__ convention) so any test that renders BranchPickerDrawer
// transitively — including ST4/ST6 integration tests — never loads the real
// @react-google-maps/api script. Used via `jest.mock("./BranchMapView")` / `jest.mock("../../branch/components/BranchMapView")` with no factory.
export const BranchMapView = jest.fn<JSX.Element, [BranchMapViewProps]>((props: BranchMapViewProps) => (
    <div data-testid="branch-map-view-mock">
        {props.branches.map((branch) => (
            <button key={branch.id} onClick={() => props.onSelectBranch(branch)}>
                {branch.branchName}
            </button>
        ))}
    </div>
));
