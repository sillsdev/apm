import { useGlobal } from '../context/useGlobal';

export enum AlertSeverity {
  Error = 'error',
  Info = 'info',
  Success = 'success',
  Warning = 'warning',
}

export const useSnackBar = () => {
  const [, setMessage] = useGlobal('snackMessage');
  const [, setAlert] = useGlobal('snackAlert');

  const messageReset = () => {
    setMessage(<></>);
  };

  const showMessage = (msg: string | JSX.Element, alert?: AlertSeverity) => {
    setAlert(alert);
    if (typeof msg === 'string') {
      setMessage(<span>{msg}</span>);
    } else setMessage(msg);
  };

  const showTitledMessage = (title: string, msg: JSX.Element | string) => {
    setMessage(
      <span>
        {title}
        <br />
        {msg}
      </span>
    );
  };

  return {
    showMessage,
    showTitledMessage,
    messageReset,
  };
};
