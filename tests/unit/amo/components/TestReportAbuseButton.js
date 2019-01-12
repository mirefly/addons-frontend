import { mount } from 'enzyme';
import * as React from 'react';

import ReportAbuseButton, {
  ReportAbuseButtonBase,
} from 'amo/components/ReportAbuseButton';
import { setError } from 'core/actions/errors';
import I18nProvider from 'core/i18n/Provider';
import {
  loadAddonAbuseReport,
  sendAddonAbuseReport,
  showAddonAbuseReportUI,
  hideAddonAbuseReportUI,
} from 'core/reducers/abuse';
import ErrorList from 'ui/components/ErrorList';
import DismissibleTextForm from 'ui/components/DismissibleTextForm';
import {
  createFakeAddonAbuseReport,
  createFakeEvent,
  createStubErrorHandler,
  dispatchClientMetadata,
  fakeAddon,
  fakeI18n,
  shallowUntilTarget,
} from 'tests/unit/helpers';

describe(__filename, () => {
  const defaultRenderProps = {
    addon: { ...fakeAddon, slug: 'my-addon' },
    errorHandler: createStubErrorHandler(),
    i18n: fakeI18n(),
    store: dispatchClientMetadata().store,
  };

  function renderMount({ ...props } = {}) {
    return mount(
      <I18nProvider i18n={props.i18n || defaultRenderProps.i18n}>
        <ReportAbuseButton {...defaultRenderProps} {...props} />
      </I18nProvider>,
    );
  }

  function renderShallow({ ...props } = {}) {
    return shallowUntilTarget(
      <ReportAbuseButton {...defaultRenderProps} {...props} />,
      ReportAbuseButtonBase,
    );
  }

  it('renders nothing if no add-on exists', () => {
    const root = renderShallow({ addon: null });

    expect(root.find('.ReportAbuseButton')).toHaveLength(0);
  });

  it('render textarea and buttons when add-on exists', () => {
    const root = renderShallow();

    expect(root.find('.ReportAbuseButton')).toHaveLength(1);
    expect(root.find('.ReportAbuseButton-show-more').prop('children')).toEqual(
      'Report this add-on for abuse',
    );
    expect(root.find(DismissibleTextForm)).toHaveProp(
      'submitButtonText',
      'Send abuse report',
    );
    expect(root.find(DismissibleTextForm)).toHaveProp(
      'dismissButtonText',
      'Dismiss',
    );
    expect(root.find(DismissibleTextForm)).toHaveProp(
      'placeholder',
      'Explain how this add-on is violating our policies.',
    );
    expect(root.find(DismissibleTextForm)).toHaveProp(
      'submitButtonInProgressText',
      'Sending abuse report',
    );
  });

  it('shows the preview content when first rendered', () => {
    const root = renderShallow();

    expect(root.find('.ReportAbuseButton--is-expanded')).toHaveLength(0);
  });

  it('shows more content when the "report" button is clicked', () => {
    const addon = { ...fakeAddon, slug: 'my-addon-show-UI' };
    const fakeEvent = createFakeEvent();
    const { store } = dispatchClientMetadata();
    const dispatchSpy = sinon.spy(store, 'dispatch');
    // We need to use mount here because we're interacting with refs. (In
    // this case, the textarea.)
    const root = renderMount({ addon, store });

    root
      .find('button.ReportAbuseButton-show-more')
      .simulate('click', fakeEvent);

    sinon.assert.called(fakeEvent.preventDefault);
    sinon.assert.calledWith(dispatchSpy, showAddonAbuseReportUI({ addon }));
    expect(root.find('.ReportAbuseButton--is-expanded')).toHaveLength(1);
  });

  it('dispatches hideAddonAbuseReportUI when "onDismiss" is called', () => {
    const addon = { ...fakeAddon, slug: 'my-addon-hide-UI' };
    const { store } = dispatchClientMetadata();
    const dispatchSpy = sinon.spy(store, 'dispatch');
    const root = renderShallow({ addon, store });

    root.find(DismissibleTextForm).prop('onDismiss')();

    sinon.assert.calledWith(dispatchSpy, hideAddonAbuseReportUI({ addon }));
  });

  it('dispatches sendAddonAbuseReport when "onSubmit" is called', () => {
    const addon = { ...fakeAddon, slug: 'my-addon-send-report' };
    const { store } = dispatchClientMetadata();
    const dispatchSpy = sinon.spy(store, 'dispatch');
    const message = 'This is abuse report';
    const root = renderShallow({ addon, store });

    root.find(DismissibleTextForm).prop('onSubmit')({
      event: createFakeEvent(),
      text: message,
    });

    sinon.assert.calledWith(
      dispatchSpy,
      sendAddonAbuseReport({
        addonSlug: addon.slug,
        errorHandlerId: root.instance().props.errorHandler.id,
        message,
      }),
    );
  });

  it('shows a success message and hides the button if report was sent', () => {
    const addon = { ...fakeAddon, slug: 'bank-machine-skimmer' };
    const { store } = dispatchClientMetadata();
    const abuseResponse = createFakeAddonAbuseReport({
      addon,
      message: 'Seriously, where is my money?!',
    });

    store.dispatch(loadAddonAbuseReport(abuseResponse));
    const root = renderShallow({ addon, store });

    expect(root.find('.ReportAbuseButton--report-sent')).toHaveLength(1);
    expect(root.find('.ReportAbuseButton-show-more')).toHaveLength(0);
    expect(root.find('button.ReportAbuseButton-send-report')).toHaveLength(0);
  });

  // This is a bit of a belt-and-braces approach, as the button that
  // activates this function is disabled when the textarea is empty.
  it('does not allow dispatch if there is no content in the textarea', () => {
    const fakeEvent = createFakeEvent();
    const addon = { ...fakeAddon, slug: 'this-should-not-happen' };
    const { store } = dispatchClientMetadata();
    const dispatchSpy = sinon.spy(store, 'dispatch');
    const message = '';
    const root = renderShallow({ addon, store });

    dispatchSpy.resetHistory();
    root.find(DismissibleTextForm).prop('onSubmit')({
      event: fakeEvent,
      text: message,
    });

    sinon.assert.notCalled(dispatchSpy);
  });

  it('renders an error if one exists', () => {
    const errorHandler = createStubErrorHandler();
    const { store } = dispatchClientMetadata();

    store.dispatch(
      setError({
        error: new Error('something bad'),
        id: errorHandler.id,
      }),
    );
    const root = renderShallow({ errorHandler, store });

    expect(root.find(ErrorList)).toHaveLength(1);
  });

  it('does not dismiss when is submitting', () => {
    const addon = { ...fakeAddon, slug: 'my-addon-not-dimiss' };
    const { store } = dispatchClientMetadata();
    const errorHandler = createStubErrorHandler();
    const dispatchSpy = sinon.spy(store, 'dispatch');
    const message = 'This is abuse report';

    store.dispatch(
      sendAddonAbuseReport({
        addonSlug: addon.slug,
        errorHandlerId: errorHandler.id,
        message,
      }),
    );
    const root = renderShallow({ addon, store });

    expect(root.find(DismissibleTextForm).prop('isSubmitting')).toEqual(true);
    dispatchSpy.resetHistory();
    root.find(DismissibleTextForm).prop('onDismiss')();
    sinon.assert.notCalled(dispatchSpy);
  });
});
