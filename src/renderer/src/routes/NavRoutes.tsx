import {
  Route,
  createRoutesFromElements,
  createHashRouter,
  createBrowserRouter,
  RouterProvider,
} from 'react-router-dom';
import Logout from './Logout';
import Loading from './Loading';
import CreateProfile from './CreateProfile';
import { default as Team } from './TeamScreen';
import { default as Teams } from './TeamsScreen';
import { default as Plan } from './PlanScreen';
import Buggy from './Buggy';
import EmailUnverified from './EmailUnverified';
import Access from './Access';
import Welcome from './Welcome';
import { HTMLPage } from '../components/HTMLPage';
import { termsContent } from './TermsContent';
import { privacyContent } from './privacyContent';
import { default as Detail } from './PassageDetail';
import { default as Auth } from '../hoc/PrivateRoute';
import { isElectron } from '../../api-variable';
import { MOBILETEAM } from '../utils/routePaths';
import { ErrorPage } from '../components/ErrorPage';
import { ScriptureBurrito } from './ScriptureBurrito';
import { BurritoStep } from './BurritoStep';
import { BurritoBooks } from './BurritoBooks';
import { BurritoContents } from './BurritoContents';
import { BurritoWrapper } from './BurritoWrapper';
import { ProjectsScreen } from './ProjectsScreen';

const routes = createRoutesFromElements([
  <Route key="error" errorElement={<ErrorPage />}>
    <Route key="access" path="/access/:users" element={<Access />} />
    <Route key="buggy" path="/error" element={<Buggy />} />
    <Route
      key="emailunverified"
      path="/emailunverified"
      element={<EmailUnverified />}
    />
    <Route key="logout" path="/logout" element={<Logout />} />
    <Route
      key="terms"
      path="/terms"
      element={<HTMLPage text={termsContent} />}
    />
    <Route
      key="privacy"
      path="/privacy"
      element={<HTMLPage text={privacyContent} />}
    />
    <Route key="loading" path="/loading" element={<Auth el={<Loading />} />} />
    <Route
      key="createProfile"
      path="/createProfile"
      element={<Auth el={<CreateProfile />} />}
    />
    <Route key="teams" path={MOBILETEAM} element={<Auth el={<Teams />} />} />
    <Route key="team" path="/team" element={<Auth el={<Team />} />} />
    <Route
      key="burrito-books"
      path="/burrito/:teamId/books"
      element={<Auth el={<BurritoBooks />} />}
    />
    <Route
      key="burrito-contents"
      path="/burrito/:teamId/contents"
      element={<Auth el={<BurritoContents />} />}
    />
    <Route
      key="burrito-wrapper"
      path="/burrito/:teamId/wrapper"
      element={<Auth el={<BurritoWrapper />} />}
    />
    <Route
      key="burrito-step"
      path="/burrito/:teamId/:step"
      element={<Auth el={<BurritoStep />} />}
    />
    <Route
      key="burrito-main"
      path="/burrito/:teamId"
      element={<Auth el={<ScriptureBurrito />} />}
    />
    <Route
      key="projects"
      path="/projects/:teamId"
      element={<Auth el={<ProjectsScreen />} />}
    />
    <Route
      key="plan"
      path="/plan/:prjId/:tabNm"
      element={<Auth el={<Plan />} />}
    />
    <Route
      key="work-detail"
      path="/work/:prjId/:pasId"
      element={<Auth el={<Team />} />}
    />
    <Route key="work" path="/work/:prjId" element={<Auth el={<Team />} />} />
    <Route
      key="detail-media"
      path="/detail/:prjId/:pasId/:mediaId"
      element={<Auth el={<Detail />} />}
    />
    <Route
      key="detail"
      path="/detail/:prjId/:pasId"
      element={<Auth el={<Detail />} />}
    />
    <Route key="welcome" path="/" element={<Welcome />} />
    <Route key="catchall" path="*" element={<Team />} />
  </Route>,
]);

export default (
  <RouterProvider
    router={isElectron ? createHashRouter(routes) : createBrowserRouter(routes)}
  />
);
