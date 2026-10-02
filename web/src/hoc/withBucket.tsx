import { ComponentType, FC } from 'react';
import { useGlobal } from '../context/useGlobal';
import JSONAPISource from '@orbit/jsonapi';

type WithBucketInjectedProps = {
  resetRequests: () => Promise<void>;
  isRequestQueueEmpty: () => boolean;
};

export const withBucket = <P extends object>(Component: ComponentType<P>) => {
  const WithBucket: FC<P> = (props) => {
    const [coordinator] = useGlobal('coordinator');
    const remote = coordinator?.getSource('remote') as JSONAPISource;

    const resetRequests = () => {
      return remote && remote.requestQueue.clear();
    };

    const isRequestQueueEmpty = () => {
      return !remote || remote.requestQueue.empty;
    };

    const Wrapped = Component as ComponentType<P & WithBucketInjectedProps>;
    return (
      <Wrapped
        resetRequests={resetRequests}
        isRequestQueueEmpty={isRequestQueueEmpty}
        {...(props as P)}
      />
    );
  };

  WithBucket.displayName = `withBucket(${
    (Component as any).displayName || (Component as any).name || 'Component'
  })`;

  return WithBucket;
};
