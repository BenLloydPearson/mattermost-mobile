// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.
import React, {useEffect} from 'react';
import {View} from 'react-native';

import {fetchAllTeams} from '@actions/remote/team';
import {useServerUrl} from '@app/context/server_url';
import {useTheme} from '@app/context/theme';
import TeamModel from '@typings/database/models/servers/team';
import {makeStyleSheetFromTheme} from '@utils/theme';

import AddTeam from './add_team/add_team';
import ServerIcon from './server_icon/server_icon';
import TeamList from './team_list';

type Props = {
    canCreateTeams: boolean;
    otherTeams: TeamModel[];
}
export default function TeamSidebar({canCreateTeams, otherTeams}: Props) {
    const theme = useTheme();
    const styles = getStyleSheet(theme);

    const serverUrl = useServerUrl();
    useEffect(() => {
        fetchAllTeams(serverUrl);
    }, [serverUrl]);

    const showAddTeam = canCreateTeams || otherTeams.length > 0;

    return (
        <View style={styles.container}>
            <ServerIcon/>
            <View style={styles.listContainer}>
                <TeamList/>
                {showAddTeam && (
                    <AddTeam
                        canCreateTeams={canCreateTeams}
                        otherTeams={otherTeams}
                    />
                )}
            </View>
        </View>
    );
}

const getStyleSheet = makeStyleSheetFromTheme((theme: Theme) => {
    return {
        container: {
            width: 72,
            height: '100%',
            backgroundColor: theme.sidebarBg,
            display: 'flex',
        },
        listContainer: {
            backgroundColor: theme.sidebarTeamBarBg,
            borderTopRightRadius: 12,
            flex: 1,
        },
    };
});
