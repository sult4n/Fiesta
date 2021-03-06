import { Component, OnInit, Input } from '@angular/core';
import { Store } from '@ngrx/store';
import { App, NavParams, NavController, ViewController, ModalController } from 'ionic-angular';
import { Observable } from 'rxjs/Observable';
import { map } from 'rxjs/operators/map';
import { User } from '../../interfaces/User';
import { Party } from '../../interfaces/Party';
import { AppState } from '../../store/reducers';
import { Logout } from '../../store/user/user.actions';
import { AddToFriendRequests, AddFromFriendRequests } from '../../store/friend-requests/friend-requests.actions';
import { AddFriends } from '../../store/friends/friends.actions';
import { UserProvider } from '../../providers/user/user';
import { LoadingUiProvider } from '../../providers/loading-ui/loading-ui';
import { LoginPage } from '../../pages/login/login';

@Component({
  selector: 'profile',
  templateUrl: 'profile.html'
})
export class ProfileComponent implements OnInit {

  @Input('user') inUser: User
  @Input('isProfilePage') isProfilePage: boolean

  user: User
  currentUser: User
  isUserProfile: boolean
  isPendingFriendRequest$: Observable<boolean>
  isFriendOfCurrentUser$: Observable<boolean>
  hasAskedToFriend$: Observable<boolean>
  friends: User[] = []
  parties: Party[] = []
  partiesHosted: Party[] = []

  constructor(
    public app: App,
    public modalCtrl: ModalController,
    public navCtrl: NavController,
    public view: ViewController,
    public navParams: NavParams,
    public userProvider: UserProvider,
    public loadingUIProvider: LoadingUiProvider,
    private store: Store<AppState>,
  ) { }

  ngOnInit() {
    this.user = this.inUser || this.navParams.get('user');
    this.ionViewWillLoad();
  }

  ionViewWillLoad() {
    if (!this.user) {
      this.user = this.inUser || this.navParams.get('user');
    }

    this.store.select('user')
      .take(1)
      .subscribe((user) => {
        this.currentUser = user;
        this.isUserProfile = this.isUserProfile || user.id == this.user.id;
      });

    this.isFriendOfCurrentUser$ = this.store.select('friends').pipe(
      map(friends => !!friends.find(friend => friend.id === this.user.id))
    );

    this.isPendingFriendRequest$ = this.store.select('friend-requests').pipe(
      map(allFriendRequests => allFriendRequests.from),
      map(friendsRequests => !!friendsRequests.find(request => request.to_user_id === this.user.id.toString()))
    );

    this.hasAskedToFriend$ = this.store.select('friend-requests').pipe(
      map(allFriendRequests => allFriendRequests.to),
      map(friendsRequests => !!friendsRequests.find(request => request.from_user_id === this.user.id.toString()))
    );

    this.userProvider.getUserFriends(this.user.id)
      .then(friends => this.friends = friends.data);

    this.userProvider.getUserParties(this.user.id)
      .then((parties) => {
        this.parties = parties.data.map(groupUser => groupUser.party);
        this.partiesHosted = parties.data
          .filter(groupUser => groupUser.is_host === true)
          .map(groupUser => groupUser.party);
      });
  }

  closeModal() {
    this.view.dismiss();
  }

  goToFriendsList() {
    this.navCtrl.push('FriendsPage', { friends: this.friends });
  }

  goToEditProfile() {
    const user = this.user;
    this.modalCtrl.create('EditProfilePage', { user }).present();
  }

  signout() {
    this.userProvider.googleSignout()
      .then(() => this.app.getRootNav().setRoot(LoginPage, null, { animate: true, direction: 'left' }))
      .then(() => this.store.dispatch(new Logout()));
  }

  acceptFriendRequest() {
    const { user, currentUser } = this;

    this.loadingUIProvider.load(
      async () => {
        await this.userProvider.acceptFriendRequest(user.id, currentUser.id);
        await Promise.all([
          this.userProvider.getToFriendRequests(currentUser.id)
            .then(friendRequests => this.store.dispatch(new AddToFriendRequests(friendRequests.data))),
          this.userProvider.getUserFriends(currentUser.id)
            .then(friends => this.store.dispatch(new AddFriends(friends.data))),
        ])
      },
      'Something went wrong when accepting the friend request.',
    );
  }

  sendFriendRequest() {
    const { user, currentUser } = this;

    this.loadingUIProvider.load(
      async () => {
        await this.userProvider.sendFriendRequest(currentUser.id, user.id);
        const friendRequestsResponse = await this.userProvider.getFromFriendRequests(currentUser.id);
        this.store.dispatch(new AddFromFriendRequests(friendRequestsResponse.data));
      },
      'Something went wrong when sending the friend request.',
    );
  }

  unfriend() {
    const { user, currentUser } = this;

    this.loadingUIProvider.load(
      async () => {
        await this.userProvider.unfriend(currentUser.id, user.id);
        const friendsResponse = await this.userProvider.getUserFriends(currentUser.id);
        this.store.dispatch(new AddFriends(friendsResponse.data));
      },
      'Something went wrong when sending the friend request.',
    );
  }

}
