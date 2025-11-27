// Mock NavRoutes to break circular dependency in component tests
// This prevents the circular dependency: SwitchTeams -> AppHead -> App -> NavRoutes -> SwitchTeams
export default <div data-testid="mock-nav-routes">Mock NavRoutes</div>;
