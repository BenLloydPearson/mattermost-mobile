// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {useManagedConfig, ManagedConfig} from '@mattermost/react-native-emm';
import React, {useCallback, useEffect, useRef, useState} from 'react';
import {useIntl} from 'react-intl';
import {
    ActivityIndicator, EventSubscription, Keyboard, KeyboardAvoidingView,
    Platform, StatusBar, StyleSheet, TextInput, TouchableWithoutFeedback, View,
} from 'react-native';

import {TextInput as PaperTextInput} from 'react-native-paper';
import Button from 'react-native-button';
import {Navigation, NavigationFunctionComponent} from 'react-native-navigation';
import {SafeAreaView} from 'react-native-safe-area-context';

import {doPing} from '@actions/remote/general';
import {fetchConfigAndLicense} from '@actions/remote/systems';
import LocalConfig from '@assets/config.json';
import AppVersion from '@components/app_version';
import ErrorText from '@components/error_text';
import FormattedText from '@components/formatted_text';
import {Screens} from '@constants';
import NetworkManager from '@init/network_manager';
import {goToScreen} from '@screens/navigation';
import {isMinimumServerVersion} from '@utils/helpers';
import {preventDoubleTap} from '@utils/tap';
import {changeOpacity, makeStyleSheetFromTheme} from '@utils/theme';
import {getServerUrlAfterRedirect, isValidUrl, sanitizeUrl} from '@utils/url';

import {DeepLinkWithData, LaunchProps, LaunchType} from '@typings/launch';

interface ServerProps extends LaunchProps {
    componentId: string;
    theme: Theme;
}

let cancelPing: undefined | (() => void);

const Server: NavigationFunctionComponent = ({componentId, extra, launchType, launchError, theme}: ServerProps) => {
    // TODO: If we have LaunchProps, ensure they get passed along to subsequent screens
    // so that they are eventually accessible in the Channel screen.

    const intl = useIntl();
    const managedConfig = useManagedConfig<ManagedConfig>();
    const input = useRef<TextInput>(null);
    const [connecting, setConnecting] = useState(false);
    const initialError = launchError && launchType === LaunchType.Notification ? intl.formatMessage({
        id: 'mobile.launchError.notification',
        defaultMessage: 'Did not find a server for this notification',
    }) : undefined;
    const [error, setError] = useState<Partial<ClientErrorProps>|string|undefined>(initialError);

    const [url, setUrl] = useState<string>('');
    const [displayName, setDisplayName] = useState<string>('');
    const styles = getStyleSheet(theme);
    const {formatMessage} = intl;

    const displayLogin = (serverUrl: string, config: ClientConfig, license: ClientLicense) => {
        const samlEnabled = config.EnableSaml === 'true' && license.IsLicensed === 'true' && license.SAML === 'true';
        const gitlabEnabled = config.EnableSignUpWithGitLab === 'true';
        const googleEnabled = config.EnableSignUpWithGoogle === 'true' && license.IsLicensed === 'true';
        const o365Enabled = config.EnableSignUpWithOffice365 === 'true' && license.IsLicensed === 'true' && license.Office365OAuth === 'true';
        const openIdEnabled = config.EnableSignUpWithOpenId === 'true' && license.IsLicensed === 'true' && isMinimumServerVersion(config.Version, 5, 33, 0);

        let screen = Screens.LOGIN;
        let title = formatMessage({id: 'mobile.routes.login', defaultMessage: 'Login'});
        if (samlEnabled || gitlabEnabled || googleEnabled || o365Enabled || openIdEnabled) {
            screen = Screens.LOGIN_OPTIONS;
            title = formatMessage({id: 'mobile.routes.loginOptions', defaultMessage: 'Login Chooser'});
        }

        const {allowOtherServers} = managedConfig;
        let visible = !LocalConfig.AutoSelectServerUrl;

        if (allowOtherServers === 'false') {
            visible = false;
        }

        const passProps = {
            config,
            extra,
            launchError,
            launchType,
            license,
            theme,
            serverUrl,
        };

        const defaultOptions = {
            popGesture: visible,
            topBar: {
                visible,
                height: visible ? null : 0,
            },
        };

        goToScreen(screen, title, passProps, defaultOptions);
        setConnecting(false);
        setUrl(serverUrl);
    };

    const handleConnect = preventDoubleTap((manualUrl?: string) => {
        if (connecting && cancelPing) {
            cancelPing();
            return;
        }

        let serverUrl = typeof manualUrl === 'string' ? manualUrl : url;
        if (!serverUrl || serverUrl.trim() === '') {
            setError(intl.formatMessage({
                id: 'mobile.server_url.empty',
                defaultMessage: 'Please enter a valid server URL',
            }));

            return;
        }

        serverUrl = sanitizeUrl(serverUrl);
        if (!isValidUrl(serverUrl)) {
            setError(formatMessage({
                id: 'mobile.server_url.invalid_format',
                defaultMessage: 'URL must start with http:// or https://',
            }));

            return;
        }

        pingServer(serverUrl);
    });

    const pingServer = async (pingUrl: string, retryWithHttp = true) => {
        let canceled = false;
        setConnecting(true);
        setError(undefined);

        cancelPing = () => {
            // We should not need this once we have the cancelable network-client library
            canceled = true;
            setConnecting(false);
            cancelPing = undefined;
        };

        const serverUrl = await getServerUrlAfterRedirect(pingUrl, !retryWithHttp);
        const result = await doPing(serverUrl);

        if (canceled) {
            return;
        }

        if (result.error) {
            if (retryWithHttp) {
                const nurl = serverUrl.replace('https:', 'http:');
                pingServer(nurl, false);
            } else {
                setError(result.error);
                setConnecting(false);
            }

            return;
        }

        const data = await fetchConfigAndLicense(serverUrl);
        if (data.error) {
            setError(data.error);
            setConnecting(false);
            return;
        }

        displayLogin(serverUrl, data.config!, data.license!);
    };

    const blur = useCallback(() => {
        input.current?.blur();
    }, []);

    const handleUrlTextChanged = useCallback((text: string) => {
        setUrl(text);
    }, []);

    const handleDisplayNameTextChanged = useCallback((text: string) => {
        setDisplayName(text);
    }, []);

    useEffect(() => {
        let listener: EventSubscription;
        if (Platform.OS === 'android') {
            listener = Keyboard.addListener('keyboardDidHide', blur);
        }

        return () => listener?.remove();
    }, []);

    useEffect(() => {
        let serverUrl = managedConfig?.serverUrl || LocalConfig.DefaultServerUrl;
        let autoconnect = managedConfig?.allowOtherServers === 'false' || LocalConfig.AutoSelectServerUrl;

        if (launchType === LaunchType.DeepLink) {
            const deepLinkServerUrl = (extra as DeepLinkWithData).data?.serverUrl;
            if (managedConfig) {
                autoconnect = (managedConfig.allowOtherServers === 'false' && managedConfig.serverUrl === deepLinkServerUrl);
                if (managedConfig.serverUrl !== deepLinkServerUrl || launchError) {
                    setError(intl.formatMessage({
                        id: 'mobile.server_url.deeplink.emm.denied',
                        defaultMessage: 'This app is controlled by an EMM and the DeepLink server url does not match the EMM allowed server',
                    }));
                }
            } else {
                autoconnect = true;
                serverUrl = deepLinkServerUrl;
            }
        }

        if (serverUrl) {
            // If a server Url is set by the managed or local configuration, use it.
            setUrl(serverUrl);

            if (autoconnect) {
                // If no other servers are allowed or the local config for AutoSelectServerUrl is set, attempt to connect
                handleConnect(managedConfig?.serverUrl || LocalConfig.DefaultServerUrl);
            }
        }
    }, []);

    useEffect(() => {
        const listener = {
            componentDidAppear: () => {
                if (url) {
                    NetworkManager.invalidateClient(url);
                }
            },
        };
        const unsubscribe = Navigation.events().registerComponentListener(listener, componentId);

        return () => unsubscribe.remove();
    }, [componentId, url]);

    let buttonIcon;
    let buttonText;

    if (connecting) {
        buttonIcon = (
            <ActivityIndicator
                animating={true}
                size='small'
                color={theme.buttonBg}
                style={styles.connectingIndicator}
            />
        );
        buttonText = (
            <FormattedText
                id='mobile.components.select_server_view.connecting'
                defaultMessage='Connecting...'
                style={styles.connectText}
            />
        );
    } else {
        buttonText = (
            <FormattedText
                id='mobile.components.select_server_view.connect'
                defaultMessage='Connect'
                style={styles.connectText}
            />
        );
    }

    const barStyle = Platform.OS === 'android' ? 'light-content' : 'dark-content';
    const inputDisabled = managedConfig.allowOtherServers === 'false' || connecting;

    const inputStyle = [styles.inputBox];
    if (inputDisabled) {
        inputStyle.push(styles.disabledInput);
    }

    const serverLabelText = formatMessage({
        id: 'mobile.components.select_server_view.enterServerUrl',
        defaultMessage: 'Enter Server URL',
    });

    const displayNameLabelText = formatMessage({
        id: 'mobile.components.select_server_view.displayName',
        defaultMessage: 'Display Name',
    });

    return (
        <SafeAreaView
            testID='select_server.screen'
            style={styles.container}
        >
            <KeyboardAvoidingView
                behavior='padding'
                style={styles.flex}
                keyboardVerticalOffset={0}
                enabled={Platform.OS === 'ios'}
            >
                <StatusBar barStyle={barStyle}/>
                <TouchableWithoutFeedback
                    onPress={blur}
                    accessible={false}
                >
                    <View style={styles.formContainer}>
                        <FormattedText
                            style={styles.msgWelcome}
                            id='mobile.components.select_server_view.msg_welcome'
                            defaultMessage='Welcome'
                        />
                        <FormattedText
                            style={styles.msgConnect}
                            id='mobile.components.select_server_view.msg_connect'
                            defaultMessage='Let’s Connect to a Server'
                        />
                        <FormattedText
                            style={styles.msgDescription}
                            id='mobile.components.select_server_view.msg_description'
                            defaultMessage="A Server is your team's communication hub which is accessed through a unique URL"
                        />
                        <PaperTextInput
                            mode='outlined'
                            testID='select_server.server_url.input'
                            ref={input}
                            value={url}
                            editable={!inputDisabled}
                            onChangeText={handleUrlTextChanged}
                            onSubmitEditing={handleConnect}
                            style={StyleSheet.flatten(inputStyle)}
                            autoCapitalize='none'
                            autoCorrect={false}
                            keyboardType='url'
                            label={serverLabelText}
                            theme={{colors: {primary: theme.buttonBg, placeholder: changeOpacity(theme.centerChannelColor, 0.5)}}}
                            returnKeyType='go'
                            underlineColorAndroid='transparent'
                            disableFullscreenUI={true}
                        />
                        <PaperTextInput
                            mode='outlined'
                            testID='select_server.server_display_name.input'
                            ref={input}
                            value={displayName}
                            editable={!inputDisabled}
                            onChangeText={handleDisplayNameTextChanged}
                            onSubmitEditing={handleConnect}
                            style={StyleSheet.flatten(inputStyle)}
                            autoCapitalize='none'
                            autoCorrect={false}
                            label={displayNameLabelText}
                            theme={{colors: {primary: theme.buttonBg, placeholder: changeOpacity(theme.centerChannelColor, 0.5)}}}
                            returnKeyType='go'
                            underlineColorAndroid='transparent'
                            disableFullscreenUI={true}
                        />
                        <FormattedText
                            style={styles.msgDisplayNameHelp}
                            id='mobile.components.select_server_view.displayName.help'
                            defaultMessage='Choose a display name for the server in your sidebar'
                        />
                        <Button
                            testID='select_server.connect.button'
                            onPress={handleConnect}
                            containerStyle={styles.connectButton}
                        >
                            {buttonIcon}
                            {buttonText}
                        </Button>
                        {Boolean(error) &&
                            <ErrorText
                                testID='select_server.error.text'
                                error={error!}
                                theme={theme}
                            />
                        }
                    </View>
                </TouchableWithoutFeedback>
                <AppVersion/>
            </KeyboardAvoidingView>
        </SafeAreaView>
    );
};

const getStyleSheet = makeStyleSheetFromTheme((theme: Theme) => ({
    container: {
        flex: 1,
        backgroundColor: theme.centerChannelBg,
    },
    flex: {
        flex: 1,
    },
    formContainer: {
        flex: 1,
        flexDirection: 'column',
        justifyContent: 'center',
        alignItems: 'center',
        alignSelf: 'stretch',
        paddingRight: 15,
        paddingLeft: 15,
    },
    disabledInput: {
        backgroundColor: changeOpacity(theme.centerChannelColor, 0.1),
    },
    connectButton: {
        flex: 0,
        borderRadius: 3,
        borderColor: theme.buttonBg,
        alignItems: 'center',
        borderWidth: 1,
        alignSelf: 'stretch',
        marginTop: 10,
        padding: 15,
    },
    connectingIndicator: {
        marginRight: 5,
    },
    inputBox: {
        fontSize: 16,
        height: 45,
        marginTop: 5,
        marginBottom: 5,
        flex: 0,

        // paddingLeft: 10,
        alignSelf: 'stretch',

        // borderRadius: 3,
        backgroundColor: '#FFFFFF',
        color: theme.centerChannelColor,
    },
    msgWelcome: {
        width: 374,
        height: 28,
        fontSize: 20,
        lineHeight: 28,
        alignItems: 'center',
        flex: 0,
        alignSelf: 'stretch',

        // flexGrow: 1,
        marginTop: 12,
        marginBottom: 0,

        fontWeight: '600',
        fontFamily: 'Metropolis',
        color: changeOpacity(theme.centerChannelColor, 0.64),

        // display: 'flex',
        // flex: 'none',
        // order: 0,
    },
    msgConnect: {
        width: 270,
        height: 96,

        fontFamily: 'Metropolis',
        fontSize: 40,
        lineHeight: 48,
        alignItems: 'center',
        letterSpacing: -1,

        flex: 0,
        alignSelf: 'stretch',
        color: theme.buttonBg,
        marginTop: 12,
        marginBottom: 0,

        // order: 2,
        flexGrow: 0,

        fontWeight: '600',

        // position: 'static',
        display: 'flex',
    },
    msgDescription: {
        width: 374,
        height: 48,

        fontFamily: 'Open Sans',
        fontStyle: 'normal',
        fontWeight: 'normal',
        fontSize: 16,
        lineHeight: 24,

        alignItems: 'center',
        flex: 0,
        alignSelf: 'stretch',
        marginTop: 12,
        marginBottom: 0,

        color: changeOpacity(theme.centerChannelColor, 0.64),

        // flexGrow: 0,
    },
    msgDisplayNameHelp: {
        width: 296,
        height: 16,
        flex: 0,
        fontFamily: 'Open Sans',
        fontStyle: 'normal',
        fontWeight: 'normal',
        fontSize: 12,
        alignItems: 'center',
        alignSelf: 'stretch',
        lineHeight: 16,
        color: changeOpacity(theme.centerChannelColor, 0.64),
    },

    connectText: {
        textAlign: 'center',
        color: theme.buttonBg,
        fontSize: 17,
    },
}));

export default Server;
