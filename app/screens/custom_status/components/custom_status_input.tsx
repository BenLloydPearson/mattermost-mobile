// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {useIntl} from 'react-intl';
import {TextInput, View} from 'react-native';

import ClearButton from '@components/custom_status/clear_button';
import {CUSTOM_STATUS_TEXT_CHARACTER_LIMIT} from '@constants/custom_status';
import {changeOpacity, getKeyboardAppearanceFromTheme, makeStyleSheetFromTheme} from '@utils/theme';

import CustomStatusEmoji from './custom_status_emoji';

type Props = {
    emoji?: string;
    isStatusSet: boolean;
    onChangeText: (value: string) => void;
    onClearHandle: () => void;
    onOpenEmojiPicker: () => void;
    text?: string;
    theme: Theme;
}

const CustomStatusInput = ({emoji, isStatusSet, onChangeText, onClearHandle, onOpenEmojiPicker, text, theme}: Props) => {
    const style = getStyleSheet(theme);
    const intl = useIntl();
    const placeholder = intl.formatMessage({id: 'custom_status.set_status', defaultMessage: 'Set a Status'});

    return (
        <View style={style.inputContainer}>
            <TextInput
                testID='custom_status.input'
                autoCapitalize='none'
                autoCorrect={false}
                blurOnSubmit={false}
                disableFullscreenUI={true}
                keyboardAppearance={getKeyboardAppearanceFromTheme(theme)}
                keyboardType='default'
                maxLength={CUSTOM_STATUS_TEXT_CHARACTER_LIMIT}
                onChangeText={onChangeText}
                placeholder={placeholder}
                placeholderTextColor={changeOpacity(theme.centerChannelColor, 0.5)}
                returnKeyType='go'
                style={style.input}
                secureTextEntry={false}
                underlineColorAndroid='transparent'
                value={text}
            />
            {isStatusSet && (
                <View style={style.divider}/>
            )}
            <CustomStatusEmoji
                emoji={emoji}
                isStatusSet={isStatusSet}
                onPress={onOpenEmojiPicker}
                theme={theme}
            />
            {isStatusSet ? (
                <View
                    style={style.clearButton}
                    testID='custom_status.input.clear.button'
                >
                    <ClearButton
                        handlePress={onClearHandle}
                        theme={theme}
                    />
                </View>
            ) : null}
        </View>
    );
};

const getStyleSheet = makeStyleSheetFromTheme((theme: Theme) => {
    return {
        divider: {
            backgroundColor: changeOpacity(theme.centerChannelColor, 0.2),
            height: 1,
            marginRight: 16,
            marginLeft: 52,
        },
        clearButton: {
            position: 'absolute',
            top: 3,
            right: 14,
        },
        input: {
            alignSelf: 'stretch',
            color: theme.centerChannelColor,
            width: '100%',
            fontSize: 17,
            paddingHorizontal: 52,
            textAlignVertical: 'center',
            height: '100%',
        },
        inputContainer: {
            justifyContent: 'center',
            height: 48,
            backgroundColor: theme.centerChannelBg,
        },
    };
});

export default CustomStatusInput;