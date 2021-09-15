// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {Text, TouchableOpacity, View} from 'react-native';

import CompassIcon from '@components/compass_icon';
import CustomStatusExpiry from '@components/custom_status/custom_status_expiry';
import FormattedText from '@components/formatted_text';
import {CustomStatusDuration} from '@constants/custom_status';
import {changeOpacity, makeStyleSheetFromTheme} from '@utils/theme';

import type UserModel from '@typings/database/models/servers/user';
import type {Moment} from 'moment-timezone';
import type {IntlShape} from 'react-intl';

type Props = {
    currentUser: UserModel;
    duration: keyof typeof CustomStatusDuration;
    intl: IntlShape;
    onOpenClearAfterModal: () => void;
    theme: Theme;
    expiresAt: Moment;
}

const ClearAfter = ({currentUser, duration, intl, expiresAt, onOpenClearAfterModal, theme}: Props) => {
    const style = getStyleSheet(theme);
    const renderClearAfterTime = () => {
        if (duration && duration === CustomStatusDuration.DATE_AND_TIME.value) {
            return (
                <View style={style.expiryTime}>
                    <CustomStatusExpiry
                        currentUser={currentUser}
                        textStyles={style.customStatusExpiry}
                        theme={theme}
                        time={expiresAt.toDate()}
                    />
                </View>
            );
        }

        return (
            <FormattedText
                id={CustomStatusDuration[duration].id}
                defaultMessage={CustomStatusDuration[duration].defaultMessage}
                style={style.expiryTime}
            />
        );
    };

    return (
        <TouchableOpacity
            testID={'custom_status.clear_after.action'}
            onPress={onOpenClearAfterModal}
        >
            <View
                testID={`custom_status.duration.${duration}`}
                style={style.inputContainer}
            >
                <Text style={style.expiryTimeLabel}>{intl.formatMessage({id: 'mobile.custom_status.clear_after', defaultMessage: 'Clear After'})}</Text>
                {renderClearAfterTime()}
                <CompassIcon
                    name='chevron-right'
                    size={24}
                    style={style.rightIcon}
                />
            </View>
        </TouchableOpacity>
    );
};

const getStyleSheet = makeStyleSheetFromTheme((theme: Theme) => {
    return {
        rightIcon: {
            position: 'absolute',
            right: 18,
            color: changeOpacity(theme.centerChannelColor, 0.5),
        },
        expiryTimeLabel: {
            fontSize: 17,
            paddingLeft: 16,
            textAlignVertical: 'center',
            color: theme.centerChannelColor,
        },
        inputContainer: {
            justifyContent: 'center',
            height: 48,
            backgroundColor: theme.centerChannelBg,
        },
    };
});

export default ClearAfter;
